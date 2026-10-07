#!/usr/bin/env bash
# Разворачивает сервер синхронизации в AWS (eu-west-1): S3 + Lambda + Function URL.
# Повторный запуск обновляет код функции. Код приглашения хранится только локально в .secrets/.
set -euo pipefail
cd "$(dirname "$0")/.."

REGION=eu-west-1
FN=gym-sync
ROLE=gym-sync-lambda
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
BUCKET="gym-sync-${ACCOUNT}-euw1"
ORIGINS='["https://kostevskygroup.github.io","http://localhost:8767"]'
mkdir -p .secrets
INVITE_FILE=.secrets/invite.txt

if [ ! -s "$INVITE_FILE" ]; then
  node -e 'const c=require("crypto");const a="ABCDEFGHJKMNPQRSTUVWXYZ23456789";let s="";for(let i=0;i<12;i++)s+=a[c.randomInt(a.length)];console.log("ZAL-"+s.slice(0,4)+"-"+s.slice(4,8)+"-"+s.slice(8))' > "$INVITE_FILE"
  chmod 600 "$INVITE_FILE"
fi
INVITE_SHA=$(node -e 'import("./sync-server/handler.mjs").then(m=>console.log(m.inviteHash(require("fs").readFileSync(process.argv[1],"utf8"))))' "$INVITE_FILE")

echo "== S3 bucket $BUCKET"
if ! aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" --create-bucket-configuration LocationConstraint="$REGION" >/dev/null
fi
aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-encryption --bucket "$BUCKET" --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws s3api put-bucket-versioning --bucket "$BUCKET" --versioning-configuration Status=Enabled
aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" --lifecycle-configuration '{"Rules":[{"ID":"old-versions-30d","Status":"Enabled","Filter":{},"NoncurrentVersionExpiration":{"NoncurrentDays":30},"AbortIncompleteMultipartUpload":{"DaysAfterInitiation":1}}]}'

echo "== IAM role $ROLE"
if ! aws iam get-role --role-name "$ROLE" >/dev/null 2>&1; then
  aws iam create-role --role-name "$ROLE" --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
  CREATED_ROLE=1
fi
aws iam attach-role-policy --role-name "$ROLE" --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam put-role-policy --role-name "$ROLE" --policy-name gym-sync-s3 --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":[\"s3:GetObject\",\"s3:PutObject\"],\"Resource\":\"arn:aws:s3:::${BUCKET}/u/*\"},{\"Effect\":\"Allow\",\"Action\":\"s3:ListBucket\",\"Resource\":\"arn:aws:s3:::${BUCKET}\",\"Condition\":{\"StringLike\":{\"s3:prefix\":[\"u/*\"]}}}]}"
ROLE_ARN=$(aws iam get-role --role-name "$ROLE" --query Role.Arn --output text)
[ "${CREATED_ROLE:-0}" = 1 ] && { echo "   ждём, пока роль станет доступна…"; sleep 12; }

echo "== Lambda $FN"
TMP=$(mktemp -d); cp sync-server/handler.mjs sync-server/index.mjs "$TMP/"; (cd "$TMP" && zip -q fn.zip handler.mjs index.mjs)
ENV="Variables={BUCKET=${BUCKET},INVITE_SHA=${INVITE_SHA}}"
if aws lambda get-function --function-name "$FN" --region "$REGION" >/dev/null 2>&1; then
  aws lambda update-function-code --function-name "$FN" --region "$REGION" --zip-file "fileb://$TMP/fn.zip" >/dev/null
  aws lambda wait function-updated --function-name "$FN" --region "$REGION"
  aws lambda update-function-configuration --function-name "$FN" --region "$REGION" --environment "$ENV" >/dev/null
else
  aws lambda create-function --function-name "$FN" --region "$REGION" --runtime nodejs22.x --architectures arm64 \
    --handler index.handler --role "$ROLE_ARN" --memory-size 256 --timeout 10 --zip-file "fileb://$TMP/fn.zip" --environment "$ENV" >/dev/null
fi
aws lambda wait function-active --function-name "$FN" --region "$REGION"
aws logs create-log-group --log-group-name "/aws/lambda/$FN" --region "$REGION" 2>/dev/null || true
aws logs put-retention-policy --log-group-name "/aws/lambda/$FN" --retention-in-days 14 --region "$REGION"

echo "== Function URL"
CORS="{\"AllowOrigins\":${ORIGINS},\"AllowMethods\":[\"GET\",\"PUT\",\"POST\"],\"AllowHeaders\":[\"content-type\",\"x-user\",\"x-token\"],\"MaxAge\":86400}"
if aws lambda get-function-url-config --function-name "$FN" --region "$REGION" >/dev/null 2>&1; then
  aws lambda update-function-url-config --function-name "$FN" --region "$REGION" --auth-type NONE --cors "$CORS" >/dev/null
else
  aws lambda create-function-url-config --function-name "$FN" --region "$REGION" --auth-type NONE --cors "$CORS" >/dev/null
  aws lambda add-permission --function-name "$FN" --region "$REGION" --statement-id public-url --action lambda:InvokeFunctionUrl --principal '*' --function-url-auth-type NONE >/dev/null
  aws lambda add-permission --function-name "$FN" --region "$REGION" --statement-id public-url-invoke --action lambda:InvokeFunction --principal '*' --invoked-via-function-url >/dev/null 2>&1 || true
fi
URL=$(aws lambda get-function-url-config --function-name "$FN" --region "$REGION" --query FunctionUrl --output text)
rm -rf "$TMP"
echo "URL=$URL"
echo "export const SYNC_URL = '${URL%/}';" > js/sync-config.js
echo "Код приглашения: $INVITE_FILE"

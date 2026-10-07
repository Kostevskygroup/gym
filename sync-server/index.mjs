// Точка входа AWS Lambda: S3 как хранилище. SDK v3 уже есть в среде Node.js 22 у Lambda.
import {S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command} from '@aws-sdk/client-s3';
import {handle} from './handler.mjs';

const s3 = new S3Client({}), Bucket = process.env.BUCKET;
const store = {
  async get(Key) {
    try {
      const r = await s3.send(new GetObjectCommand({Bucket, Key}));
      return {body: await r.Body.transformToString(), etag: r.ETag};
    } catch (e) {if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) return null; throw e;}
  },
  async put(Key, Body, {ifMatch, ifNoneMatch} = {}) {
    try {
      const r = await s3.send(new PutObjectCommand({Bucket, Key, Body, ContentType: 'application/json', ...(ifMatch ? {IfMatch: ifMatch} : {}), ...(ifNoneMatch ? {IfNoneMatch: ifNoneMatch} : {})}));
      return r.ETag;
    } catch (e) {
      if (e.$metadata?.httpStatusCode === 412 || e.name === 'PreconditionFailed' || e.$metadata?.httpStatusCode === 409) throw Object.assign(new Error('precondition'), {code: 412});
      throw e;
    }
  },
  async list(Prefix) {
    const out = [];
    let ContinuationToken;
    do {
      const r = await s3.send(new ListObjectsV2Command({Bucket, Prefix, ContinuationToken}));
      (r.Contents || []).forEach(o => out.push(o.Key));
      ContinuationToken = r.IsTruncated ? r.NextContinuationToken : undefined;
    } while (ContinuationToken);
    return out;
  },
};

export const handler = event => handle(event, store, process.env);

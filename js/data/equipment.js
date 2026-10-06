// Оборудование твоего зала — по фото в img/. Программа, замены и редактор
// могут использовать только упражнения на этом оборудовании (проверяется тестами).
// step — шаг веса по умолчанию, кг (меняется в настройках упражнения).
export const EQUIP = {
  legpress: {n: 'Жим ногами Impulse', step: 2.5},
  lat: {n: 'Верхняя тяга Impulse', step: 2.5},
  chest: {n: 'Жим от груди Impulse', step: 2.5},
  shoulder: {n: 'Жим плечами Impulse', step: 2.5},
  row: {n: 'Горизонтальная тяга Impulse', step: 2.5},
  legcurl: {n: 'Сгибание ног Impulse', step: 2.5},
  legext: {n: 'Разгибание ног Impulse', step: 2.5},
  smith: {n: 'Машина Смита Life Fitness', step: 5},
  cable: {n: 'Кроссовер Life Fitness', step: 2.5},
  db: {n: 'Гантели', step: 2},
  bench: {n: 'Регулируемая скамья', step: 2},
  abbench: {n: 'Скамья для пресса', step: 1},
  bike: {n: 'Велотренажёр', step: 1},
  mat: {n: 'Коврик', step: 1, photo: false},
};

export const hasPhoto = eq => !!EQUIP[eq] && EQUIP[eq].photo !== false;

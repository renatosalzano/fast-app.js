export function is_async(func) {
  return func instanceof (async () => { }).constructor;
}

export function obj_get(object, key) {
  if (key.includes('.')) {
    key = key.split('.');
    return obj_get(object[key[0]], key[1])
  }
  return object[key];
}
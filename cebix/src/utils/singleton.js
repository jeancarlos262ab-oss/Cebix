export function lazySingleton(factory) {
  let created = false;
  let value;
  return () => {
    if (!created) {
      value = factory();
      created = true;
    }
    return value;
  };
}
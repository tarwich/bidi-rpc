export const encodeParams = (params: any[]) => {
  return params.map((param) => {
    switch (typeof param) {
      case 'function':
        return {
          type: 'function',
          value: String(param),
        };
      default:
        return {
          type: typeof param,
          value: JSON.stringify(param),
        };
    }
  });
};

export const decodeParams = (params: any[]) => {
  return params.map((param) => {
    switch (param.type) {
      case 'function':
        const scope = { require, process };
        return new Function(...Object.keys(scope), `return ${param.value}`)(
          ...Object.values(scope)
        );
      case 'string':
      case 'number':
      case 'boolean':
      case 'object':
      default:
        return JSON.parse(param.value);
    }
  });
};

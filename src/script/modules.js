

function lifecycle(fnode) {

  const lc_instances = {
    mounted: [],
    unmounted: [],
  };

  const lc = new Proxy({
    mounted(cb) {
      // async first
      if (is_async(cb)) {
        fnode.is_async = true;
        lc_instances.mounted.unshift(cb);
      } else {
        lc_instances.mounted.push(cb)
      }

      fnode.mounted = async () => {
        console.warn('[fapp] on mounted');
        for await (const func of lc_instances.mounted) {
          await func();
        }
      };
    },
    unmounted(cb) {
      lc_instances.unmounted.push(cb)
    }
  }, {
    get(t, k) {
      return Reflect.get(t, k);
    }
  });

  return lc;
}

function createState(fnode) {

  return (initial_state) => {
    if (!fnode.state) {
      // create state
      console.log(`[fapp] (${fnode.ID}) create state`)
      fnode.state = new Proxy({}, {
        get(t, k) {
          return Reflect.get(t, k)
        },
        set(t, k, v) {
          Reflect.set(t, k, v)
        }
      })
    }

    Object.entries(initial_state).forEach(([key, init_value]) => {
      fnode.state[key] = init_value;
    })

    function updateFunc(update) {
      if (typeof update === 'function') {
        update = update(fnode.state);
      }
      // TODO add check if state is changed
      Object.entries(update).forEach(([key, value]) => {
        fnode.state[key] = value
        fnode.tick("state", key, "updateFunc")
      });
    }

    return [fnode.state, updateFunc]
  }
}



function createStore(createState = {}) {
  const listeners = [];
  const store = new Proxy(createState, {
    get(target, key) {
      return Reflect.get(target, key);
    },
    set(target, key, value) {
      if (target[key] !== value) {
        if (listeners?.[key]) {
          listeners?.[key]?.forEach(u => u());
        }
        return Reflect.set(target, key, value);
      }
      return true;
    }
  });

  const methods = Object.entries(createState)
    .reduce((ret, [key, method]) => {
      if (typeof method === 'function') {
        ret[key] = method.bind(store);
        delete store[key];
      }
      return ret;
    }, {});

  function sub(key, callback) {
    if (!listeners[key]) listeners[key] = new Set();
    listeners[key].add(callback);
  }

  function unsub(key, callback) {
    listeners[key]?.delete(callback);
  }

  function $store() {
    const keys = new Set();
    const trap = new Proxy({ ...store, ...methods }, {
      get: (_, key) => {
        if (key in store) {
          keys.current.add(key);
          return store[key];
        }
        if (key in methods) {
          return methods[key];
        }
        return true;
      }
    });
  }

  return {}
}

function is_async(func, as_number) {
  let is_async_func = func instanceof (async () => { }).constructor;
  return as_number
    ? is_async_func ? 1 : 0
    : is_async_func;
}
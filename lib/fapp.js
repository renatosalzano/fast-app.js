
// import Component from ""

import { add_listener, create_fragment } from "./dom";
import FNode from "./FNode";
import { is_async, obj_get } from "./utils";

const DEV = true;
const REG = {
  var: /(?<={{).*?(?=}})/gm,
  var_replace: /{{(.*?)}}/gm,
  tag: /<(.*)>/g,
  state_replace: /state(.*?)\(/gm,
  state: /(?:(?:var|let|const)?(.*?)(?=<]|=).*?)?(state).*?\((.*?)\);?/gm,
}

function log(...args) {
  if (DEV) console.log('[fapp]', ...args)
}

function warn(...args) {
  if (DEV) console.warn('[fapp]', ...args)
}

const _ = {}

const Fapp = new Proxy(
  {
    run,
    Component(component) {
      warn('swag component');
      window.fapp.script_loaded(component);
    },
  },
  {
    set() {
      console.error('[fapp] u cant touch this.')
      return true
    }
  }
)

function parse_template(target_node, ret = {}) {

  // attributes
  for (const attr of target_node.attributes) {
    let [attr_name, attr_value] = [
      (attr.name.match(REG.var)?.[0] || "").trim(),
      (attr.value.match(REG.var)?.[0] || "").trim()
    ];
    const react_key = attr_name || attr_value;
    if (react_key) {
      const i = { target_node, template_node: target_node.cloneNode() }

      !ret[react_key]
        ? (ret[react_key] = [i])
        : (ret[react_key].push(i))

      attr_name = attr_name ? `${attr_name}` : attr.name;
      attr_value = attr_value ? `${attr_value}` : attr.value;
      const last_node = ret[react_key].at(-1);
      const react_attr = [attr_name, attr_value];

      !last_node.attr ? (last_node.attr = [react_attr]) : (last_node.attr.push(react_attr));
    }
  }

  // text content

  for (const child_node of target_node.childNodes) {

    if (child_node.nodeType === 3) {
      // is text node
      for (let react_key of (child_node.data.match(REG.var) || [])) {
        react_key = react_key.trim();
        if (react_key) {
          const i = { target_node, template_node: target_node.cloneNode() }

          !ret[react_key]
            ? (ret[react_key] = [i])
            : (ret[react_key].push([i]));

          const last_node = ret[react_key].at(-1);

          const n = { target_node: child_node, template_node: child_node.cloneNode() }

          !last_node.text_node
            ? (last_node.text_node = [n])
            : (last_node.text_node.push(n));
        }
      }
    }
  }

  for (const child of target_node.children) {
    ret = parse_template(child, ret)
  }

  return ret;
}

function get_component_object(fnode, node) {

  const component = {
    props: {}, // TODO better props declaration
    swag: {},
    future_shit: '',
    template_node: null
  }

  node.removeAttribute('f-node');

  for (const default_props of node.attributes) {
    switch (true) {
      case default_props.name.startsWith('on'):
        // event
        break;
      default:
        // props!
        component.props[default_props.name] = default_props.value;
        break;
    }
  };

  // TODO PROPS DECLARATION

  for (const child of fnode.children) {
    if (child.tagName === 'SCRIPT') {
      component.future_shit = child.innerText;
    } else {
      component.template_node = child;
    }
  };

  component.swag = parse_template(component.template_node);

  return component;

}

function tick(fnode, type, swag_key, caller) {

  warn(`(${fnode.ID}) tick ${swag_key} [${caller}]`);

  const k = swag_key;

  if (fnode.swag[k]) {
    fnode.swag[k]
      .forEach(({ target_node, ...mutations }) => {
        Object.entries(mutations)
          .forEach(([t, o]) => {
            switch (t) {
              case "attr":
                o.forEach(([name, value]) => {
                  // TODO DYNAMIC NAME ATTR
                  // name = fnode[type][name] || name;
                  value = fnode[type][value] || value;
                  target_node.setAttribute(name, value);
                })
                break;
              case "text_node":
                o.forEach(({ target_node, template_node }) => {

                  target_node.textContent = template_node.textContent
                    .match(REG.var_replace)
                    .reduce((template, replacer) => {
                      const store_key = replacer.match(REG.var)[0].trim();
                      template = template.replace(replacer, (obj_get(fnode[type], store_key) || ""))
                      return template;
                    }, template_node.textContent)

                  // const replace_key = swag_key.replace('.', '\\.').replace('$', '\\$');
                  // const replace_reg = new RegExp(`\\{\\{\\s*${replace_key}\\s*\\}\\}`, 'gm');

                  // let replacer = target_node.textContent;


                  // replacer = replacer.replace(
                  //   replace_reg,
                  //   obj_get(fnode[type], swag_key)
                  // );

                  // console.log(replacer)

                  // target_node.textContent = replacer;
                })
                break;
            }
          })
      })
  }
}

async function f_component(node) {
  const path = node.getAttribute('f-node');
  const html = await (await fetch(`${path}.html`)).text();
  const name = node.tagName.toLowerCase();

  const temp_node = document.createElement('temp');
  temp_node.innerHTML = html;

  const component_node = temp_node.querySelector(`component[f-node=${name}]`)
  if (!component_node) throw "component not found";

  // component found
  const {
    swag,
    props,
    future_shit,
    template_node
  } = get_component_object(component_node, node);

  // register component
  const fnode = document.createElement('f-node');

  fnode.ID = name + new Date().getTime();
  fnode.name = name;
  fnode.props = props;
  fnode.swag = swag;
  fnode.appendChild(template_node);

  console.dir(swag)

  temp_node.remove();

  // TODO CHANGE because i have 2 instance of same file
  window.fapp.script_loading = new Promise((res) => window.fapp.script_loaded = res);

  node.appendChild(create_fragment(future_shit));

  const h = await window.fapp.script_loading;

  function update_DOM(key, value) {
    switch (value.constructor) {
      case Object:
        Object.keys(value).forEach((k) => {
          tick(fnode, "state", `${key}.${k}`, "update state")
        })
        break;
      case Array:
        value.forEach((i) => {
          tick(fnode, "state", `${key}[${i}]`, "update state")
        })
        break;
      default:
        tick(fnode, "state", key, "update state")
    }
  }

  function update(key, value) {
    if (typeof value === 'function') {
      value = value(fnode.state[key]);
    };
    fnode.state[key] = value;
    update_DOM(key, value);
    return fnode.state[key];
  }

  const vm = new Proxy(
    {
      instances: {
        before: [],
        mounted: []
      },
      ref() { },
      before(cb) {
        if (fnode.is_mounted) return;
        if (is_async(cb)) {
          fnode.is_async = true;
        }
        vm.instances.before.push(cb);
      },
      mounted(cb) {
        if (fnode.is_mounted) return;
        vm.instances.mounted.push(cb);
      },
      state(k, value) {
        if (!k) return;
        if (!fnode.state) {
          warn(`(${fnode.ID}) created state`);

          function $(k) {
            return [
              fnode.state[k],
              (value) => update(k, value)
            ]
          };
          fnode.state = new Proxy($, {
            get(t, k) {
              return Reflect.get(t, k)
            },
            set(t, k, v) {
              if (fnode.is_mounted) {
                warn(fnode.ID, 'state is update')
              }
              return Reflect.set(t, k, v)
            }
          })
        }
        k = !k.includes("$") ? `$${k}` : k;
        fnode.state[k] = value;
        return [
          fnode.state[k],
          (value) => update(k, value)
        ]
      }
    },
    {
      get(t, k) {
        return Reflect.get(t, k)
      },
      set(t, k, v) {
        return Reflect.set(t, k, v);
      }
    }
  );

  // loading module
  const unmounted = h(vm);

  // lifecycle
  fnode.beforeMount = vm.instances.before.length > 0
    ? fnode.before = () => { vm.instances.before.forEach(f => f()) }
    : null;

  fnode.mounted = vm.instances.mounted.length > 0
    ? fnode.mounted = () => { vm.instances.mounted.forEach(f => f()) }
    : null;

  if (unmounted) fnode.unmounted = unmounted;

  Object.keys(fnode.props).forEach((k) => tick(fnode, "props", k, "init"))
  Object.keys(fnode.swag).forEach(k => tick(fnode, "state", k, "init"))

  if (fnode.is_async) {
    await fnode.before();
    fnode.before = () => null;
  }

  // Clean script tag
  node.innerHTML = '';
  // mount on DOM
  node.appendChild(fnode);


}

async function load_components() {

  try {
    // TODO config document alternative?
    for await (const node of document.querySelectorAll('[f-node]')) {
      await f_component(node);
    }

  } catch (error) {
    console.error('[fapp]', error)
  }
}

// TODO run async?
function run(config = {}) {

  // TODO remove listener after run
  add_listener(document, "readystatechange",
    (event) => {
      window.customElements.define('f-node', FNode);
      window.fapp = {};
      switch (event.target.readyState) {
        case "loading":
          break;
        case "interactive":
          break;
        case "complete":
        default:
          load_components()
          break;
      }
    });
}


export const {
  Component
} = Fapp;

export default Fapp

// export default Fapp;
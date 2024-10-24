
'use strict';
var FNODES = {};

const REG = {
  var: /(?<={{).*?(?=}})/gm,
  var_replace: /{{(.*?)}}/gm,
  tag: /<(.*)>/g,
  state_replace: /state(.*?)\(/gm,
  state: /(?:(?:var|let|const)?(.*?)(?=<]|=).*?)?(state).*?\((.*?)\);?/gm,
}

const no_func = function usless() { };

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

const Fapp = {
  dev_mode: true,
  Node: async (node) => {
    const path = node.getAttribute('f-node');
    const html = await (await fetch(`${path}.html`)).text();
    // template found

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
    } = get_component_object(component_node, node)
    // register component
    const fnode = document.createElement('f-node');

    fnode.ID = name + new Date().getTime();
    fnode.name = name;
    fnode.props = props;
    fnode.swag = swag;
    fnode.appendChild(template_node);

    temp_node.remove();

    let loaded, script_loading = new Promise((res) => loaded = res);
    Fapp["script_loaded"] = loaded;

    let ur_future_shit =
      future_shit.replace('export default', `Fapp.Component['${fnode.ID}'] = `)
      + `(function() {Fapp.script_loaded(); delete Fapp.script_loaded; })();`;

    ur_future_shit = create_fragment(ur_future_shit);
    node.appendChild(ur_future_shit);

    console.warn(`[fapp] (${fnode.ID}) loading swag...`);
    await script_loading;

    return fnode;

  },
  Component: new Proxy({
    // [ID]: component function
  }, {
    get(t, k) {
      return Reflect.get(t, k);
    },
    set(t, k, v) {
      console.warn(`[fapp] (${k}) is swag component`);
      Reflect.set(t, k, v)
      return true;
    }
  })
}

function log(node_id, text) {
  if (Fapp.dev_mode) {
    console.warn(`[fapp] (${node_id}) ${text}`)
  }
}



class FNode extends HTMLElement {
  ID;
  name;

  is_async = false;
  is_mounted = false;
  props = {};
  state = null;

  constructor() {
    super();
    // this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    log(this.ID, "is mounted.");
    this.is_mounted = true;
    if (this.is_mounted && this.mounted) {
      this.mounted();
    }
  }

  disconnectedCallback() {
    console.warn("Custom element removed from page.");
    this.unmounted && (this.unmounted())
    this.is_mounted = false;
  }

  adoptedCallback() {
    console.log("Custom element moved to new page.");
  }

  attributeChangedCallback(name, oldValue, newValue) {
    console.log(`Attribute ${name} has changed.`);
  }
}

function create_fragment(content) {
  content = `<script type="module">${content}</script>`;
  const script = document
    .createRange()
    .createContextualFragment(content)

  return script;
}

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
  let index = 0;
  for (const child_node of target_node.childNodes) {
    index += 1;
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

function tick(fnode, type, swag_key, caller) {

  console.warn(`[fapp] (${fnode.ID}) tick [${caller}]`);

  const k = type === 'state' ? '$' + swag_key : swag_key;

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
                    .replace(REG.var_replace, fnode[type][swag_key])
                })
                break;
            }
          })
      })
  }
}

async function root_component(root_ele) {

  try {
    const fnode = await Fapp.Node(root_ele);

    const swag = new Proxy(
      {
        ref() { },
        $(key, value) {
          key = !key.includes("$") ? `$${k}` : k;
          swag[key] = value;
          return [swag[key], no_func]
        }
      },
      {
        get(t, k) {
          return Reflect.get(t, k)
        },
        set(t, k, v) {
          switch (k) {
            case "props":
            case "beforeMount":
            case "mounted":
            case "unmounted":
              console.warn(`[fapp] (${fnode.ID}) ${k} is reserved keyword`)
              return true;
          }
          if (typeof v === "function") {
            // computed property
            console.log('computed property');
            return true;
          }
          if (k.includes('$'))
            return Reflect.set(t, k, v);
        }
      }
    );

    Fapp.Component[fnode.ID](fnode.props, pnode);

    return

    // TODO put inside FNODE CLASS?
    fnode.tick = (t, k, c) => tick(fnode, t, k, c);

    // LOAD MODULES
    FNODES[fnode.ID].h({
      props: fnode.props,
      ...lifecycle(fnode),
      createState: createState(fnode)
    });

    // first tick

    Object.keys(fnode.props).forEach((k) => fnode.tick("props", k, "root_component"))
    Object.keys(fnode.swag).forEach(k => fnode.tick("state", k.replace("$", ""), "root_component"))


    if (fnode.is_async) {
      console.warn('[fapp] await async mount');
      await fnode.mounted();
      delete fnode.mounted;
    }

    on_attr_change(root_ele, (name, value) => {
      fnode.props[name] = value;
      fnode.tick("props", name, 'on_attr_change');
    })

    // clean script module
    root_ele.innerHTML = "";
    root_ele.appendChild(fnode);

  } catch (err) {
    console.error(err);
  }
}

async function render(root_node = document.body) {
  window.customElements.define('f-node', FNode);
  const fapps = [];
  for await (const node of root_node.querySelectorAll('[f-node]')) {
    const fapp_node = await root_component(node);
    fapps.push(fapp_node);
  }
}




async function dev() {
  await render();
  // on_attr_change(test, (m) => {
  //   console.log(m)
  // })
  setTimeout(() => {
    const test = document.body.querySelector('test');
    // test.remove();
    test?.setAttribute('word', 'awesome')
    // test.remove()
  }, 2000)
}

window.addEventListener('DOMContentLoaded', dev)

// UTILS

function on_attr_change(target, cb) {
  console.log('on_attr_change', target)
  const MO = new MutationObserver(
    (m, obs) => m.forEach((m) => {
      if (m.type == 'attributes') {
        cb(m.attributeName, target.getAttribute(m.attributeName))
      }
    })
  )
  MO.observe(target, { attributes: true });

  return {
    stop() { MO.disconnect() }
  }
}

export default Fapp;

// export default Fapp


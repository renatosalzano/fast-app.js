'use strict';
var FNODES = {};

const REG = {
  var: /(?<={{).*?(?=}})/gm,
  var_replace: /{{(.*?)}}/gm,
  tag: /<(.*)>/g,
  state_replace: /state(.*?)\(/gm,
  state: /(?:(?:var|let|const)?(.*?)(?=<]|=).*?)?(state).*?\((.*?)\);?/gm,
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
    console.warn("[fapp] fnode is mounted.");
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

  // {props: [keys], state: [keys]}

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
    fnode.swag[k].forEach(({ target_node, ...mutations }) => {
      Object.entries(mutations).forEach(([t, o]) => {
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

    const path = root_ele.getAttribute('f-node');
    const html = await (await fetch(`${path}.html`)).text();
    // template found

    // TODO
    let cmp_name = path.split('/').at(-1);
    const tmp = document.createElement('temp');

    tmp.innerHTML = html;
    const f_node = tmp.querySelector(`component[name=${cmp_name}]`);
    if (!f_node) throw "component not found";

    // component found

    // register component
    const fnode = document.createElement('f-node');
    fnode.name = cmp_name;
    fnode.ID = cmp_name + new Date().getTime(); // TODO is ugly


    FNODES[fnode.ID] = fnode;

    let template = '', template_node = null, code = '', props = {};

    for (const child of f_node.children) {
      // get future shit
      if (child.tagName === 'SCRIPT') {
        code = child.innerText;
      } else {
        template = child.outerHTML;
        template_node = child;
      }
    }

    [...root_ele.attributes].forEach((attr) => {
      switch (true) {
        case attr.name.startsWith('f-'):
          root_ele.removeAttribute(attr.name);
          break;
        case attr.name.startsWith('on'):
          // event
          break;
        default:
          // props!
          fnode.props[attr.name] = attr.value;
          break;
      }
    });

    fnode.appendChild(template_node);
    fnode.swag = parse_template(template_node);

    // const react_template = parse_template(template_node);

    // PROPS

    let loaded, script_loading = new Promise((res) => loaded = res);
    FNODES["script_loaded"] = () => loaded();

    code = code.replace('export default', `FNODES['${fnode.ID}'].h = `);
    code += `(function() {FNODES.script_loaded(); delete FNODES.script_loaded; })();`
    code = create_fragment(code);
    root_ele.appendChild(code);

    console.warn('[fapp]: loading modules');
    await script_loading;

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
    test.setAttribute('foo', 'bar')
    // test.remove()
  }, 2000)
}

window.addEventListener('DOMContentLoaded', dev)

function Fapp() {

  return {
    ref(name) {

    }
  }
}

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

// export default Fapp


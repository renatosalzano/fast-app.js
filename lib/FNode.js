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
    console.warn(`[${this.ID}] is mounted`)
    this.is_mounted = true;
    if (this.is_mounted && this.mounted) {
      this.mounted();
    }
  }

  disconnectedCallback() {
    this.unmounted && (this.unmounted())
    this.is_mounted = false;
  }

  adoptedCallback() {
    console.log("Custom element moved to new page.");
  }

  attributeChangedCallback(name, oldValue, newValue) {
    console.log(`Attribute ${name} has changed.`);
  }
};

export default FNode;
export function add_listener(target, event, callback) {
  return target
    ? (target.addEventListener(event, callback), callback)
    : null
}

export function create_fragment(content) {
  content = `<script type="module">${content}</script>`;
  const script = document
    .createRange()
    .createContextualFragment(content)

  return script;
}
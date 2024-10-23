function on_child_change(target, cb) {
  const MO = new MutationObserver(
    (m, obs) => m.forEach((m) => {
      if (m.type == 'attributes') {
        cb(m.attributeName, target.getAttribute(m.attributeName))
      }
    })
  )
}


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
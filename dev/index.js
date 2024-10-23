function global_state() {
  const proxy = new Proxy({})
}

function Component(name) {

}


function init() {
  const app = document.querySelector("[f-app]");
  if (app) {
    // do magic stuff
    const components = app.querySelectorAll('[f-control]');
    console.log(components)

  }



  console.log(app)
  const test = document.querySelector("[f-test]")
}

window.addEventListener("DOMContentLoaded", function () {
  init()
}, false);
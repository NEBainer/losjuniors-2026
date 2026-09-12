(function () {
  'use strict';

  var splash = document.getElementById('splash');
  var btnSaltar = document.getElementById('btnSaltar');

  var yaCerrado = false;

  function cerrarSplash() {

    if (yaCerrado) {
      return;
    }

    yaCerrado = true;

    splash.classList.add('oculto');

    document.dispatchEvent(
      new CustomEvent('splash:listo')
    );

    splash.addEventListener(
      'transitionend',
      function () {
        if (splash && splash.parentNode) {
          splash.parentNode.removeChild(splash);
        }
      },
      {
        once: true
      }
    );
  }

  setTimeout(
    cerrarSplash,
    2000
  );


  splash.addEventListener(
    'click',
    cerrarSplash
  );

  if (btnSaltar) {

    btnSaltar.addEventListener(
      'click',
      function (e) {

        e.stopPropagation();

        cerrarSplash();
      }
    );

  }

  document.addEventListener(
    'keydown',
    cerrarSplash
  );

  console.log(
    '%cLA MESA',
    'color:#7A3A22;font-weight:bold;font-size:14px;',
    '— splash listo. Los Juniors, 2026.'
  );

})();
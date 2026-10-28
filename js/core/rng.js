/* Generador pseudoaleatorio con semilla (mulberry32): partidas reproducibles en pruebas. */
(function (A) {
  'use strict';

  A.core = A.core || {};
  A.core.makeRng = function (seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
})(window.Arcade = window.Arcade || {});

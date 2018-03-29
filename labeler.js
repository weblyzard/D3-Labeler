(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(['d3'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    module.exports = factory(require('d3'));
  } else {
    // Browser globals (root is window)
    root.returnExports = factory(root.d3);
  }
})(typeof self !== 'undefined' ? self : this, function(d3) {
  d3.labeler = function() {
    var lab = [],
      anc = [],
      w = 100, // box width
      h = 100, // box width
      pL = 0, // padding left
      pR = 0, // padding right
      pT = 0, // padding top
      pB = 0, // padding bottom
      labelDist = 50, // safe distance to the nearest label
      labeler = {};

    var max_move = 5.0,
      max_angle = 0.5,
      acc = 0,
      rej = 0;

    // weights
    var w_len = 0.2, // leader line length
      w_inter = 1.0, // leader line intersection
      w_lab2 = 30.0, // label-label overlap
      w_lab_anc = 30.0, // label-anchor overlap
      w_orient = 3.0; // orientation bias

    // booleans for user defined functions
    var user_energy = false,
      user_schedule = false;

    var user_defined_energy, user_defined_schedule;

    //energy function, tailored for label placement
    var energy = function(index) {
      var m = lab.length,
        ener = 0,
        dx = lab[index].x - anc[index].x,
        dy = anc[index].y - lab[index].y,
        dist = Math.sqrt(dx * dx + dy * dy),
        overlap = true;
      //amount = 0,
      //theta = 0;

      // penalty for length of leader line
      if (dist > 0) ener += dist * w_len;

      // label orientation bias
      dx /= dist;
      dy /= dist;
      if (dx > 0 && dy > 0) ener += 0 * w_orient;
      else if (dx < 0 && dy > 0) ener += 1 * w_orient;
      else if (dx < 0 && dy < 0) ener += 2 * w_orient;
      else ener += 3 * w_orient;

      var x21 = lab[index].x,
        y21 = lab[index].y - lab[index].height + 2.0,
        x22 = lab[index].x + lab[index].width,
        y22 = lab[index].y + 2.0;

      var x11, x12, y11, y12, x_overlap, y_overlap, overlap_area;

      for (var i = 0; i < m; i++) {
        if (i !== index) {
          // penalty for intersection of leader lines
          overlap = intersect(
            anc[index].x,
            lab[index].x,
            anc[i].x,
            lab[i].x,
            anc[index].y,
            lab[index].y,
            anc[i].y,
            lab[i].y
          );

          if (overlap) ener += w_inter;

          // penalty for label-label overlap
          x11 = lab[i].x;
          y11 = lab[i].y - lab[i].height + 2.0;
          x12 = lab[i].x + lab[i].width;
          y12 = lab[i].y + 2.0;
          x_overlap = Math.max(0, Math.min(x12, x22) - Math.max(x11, x21));
          y_overlap = Math.max(0, Math.min(y12, y22) - Math.max(y11, y21));
          overlap_area = x_overlap * y_overlap;
          ener += overlap_area * w_lab2;
        }

        // penalty for label-anchor overlap
        x11 = anc[i].x - anc[i].r;
        y11 = anc[i].y - anc[i].r;
        x12 = anc[i].x + anc[i].r;
        y12 = anc[i].y + anc[i].r;
        x_overlap = Math.max(0, Math.min(x12, x22) - Math.max(x11, x21));
        y_overlap = Math.max(0, Math.min(y12, y22) - Math.max(y11, y21));
        overlap_area = x_overlap * y_overlap;
        ener += overlap_area * w_lab_anc;
      }
      return ener;
    };

    // Monte Carlo translation move
    var mcmove = function(currT) {
      // select a random label
      var i = Math.floor(Math.random() * lab.length);

      // save old coordinates
      var x_old = lab[i].x;
      var y_old = lab[i].y;

      // old energy
      var old_energy;
      if (user_energy) old_energy = user_defined_energy(i, lab, anc);
      else old_energy = energy(i);

      // random translation
      lab[i].x += (Math.random() - 0.5) * max_move;
      lab[i].y += (Math.random() - 0.5) * max_move;

      // hard wall boundaries
      if (lab[i].x + lab[i].width > w - pR) lab[i].x = x_old - 100;
      if (lab[i].x < pL) lab[i].x = x_old + 1;
      if (lab[i].y > h - pB) lab[i].y = y_old - 1;
      if (lab[i].y < pT) lab[i].y = y_old + 1;

      // new energy
      var new_energy;
      if (user_energy) new_energy = user_defined_energy(i, lab, anc);
      else new_energy = energy(i);

      // delta E
      var delta_energy = new_energy - old_energy;

      if (Math.random() < Math.exp(-delta_energy / currT)) acc += 1;
      else {
        // move back to old coordinates
        lab[i].x = x_old;
        lab[i].y = y_old;
        rej += 1;
      }
    };

    // Monte Carlo rotation move
    var mcrotate = function(currT) {
      // select a random label
      var i = Math.floor(Math.random() * lab.length);

      // save old coordinates
      var x_old = lab[i].x;
      var y_old = lab[i].y;

      // old energy
      var old_energy;
      if (user_energy) old_energy = user_defined_energy(i, lab, anc);
      else old_energy = energy(i);

      // random angle
      var angle = (Math.random() - 0.5) * max_angle;

      var s = Math.sin(angle);
      var c = Math.cos(angle);

      // translate label (relative to anchor at origin):
      lab[i].x -= anc[i].x;
      lab[i].y -= anc[i].y;

      // rotate label
      var x_new = lab[i].x * c - lab[i].y * s,
        y_new = lab[i].x * s + lab[i].y * c;

      // translate label back
      lab[i].x = x_new + anc[i].x;
      lab[i].y = y_new + anc[i].y;

      // hard wall boundaries
      if (lab[i].x + lab[i].width > w - pR) lab[i].x = x_old - 100;
      if (lab[i].x < pL) lab[i].x = x_old + 1;
      if (lab[i].y > h - pB) lab[i].y = y_old - 1;
      if (lab[i].y < pT) lab[i].y = y_old + 1;

      // new energy
      var new_energy;
      if (user_energy) new_energy = user_defined_energy(i, lab, anc);
      else new_energy = energy(i);

      // delta E
      var delta_energy = new_energy - old_energy;

      if (Math.random() < Math.exp(-delta_energy / currT)) {
        acc += 1;
      } else {
        // move back to old coordinates
        lab[i].x = x_old;
        lab[i].y = y_old;
        rej += 1;
      }
    };

    // returns true if two lines intersect, else false
    // from http://paulbourke.net/geometry/lineline2d/
    var intersect = function(x1, x2, x3, x4, y1, y2, y3, y4) {
      var mua, mub;
      var denom, numera, numerb;

      denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
      numera = (x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3);
      numerb = (x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3);

      // is the intersection along the the segments
      mua = numera / denom;
      mub = numerb / denom;
      if (!(mua < 0 || mua > 1 || mub < 0 || mub > 1)) return true;
      return false;
    };

    // linear cooling
    var cooling_schedule = function(currT, initialT, nsweeps) {
      return currT - initialT / nsweeps;
    };

    // main simulated annealing function
    labeler.start = function(nsweeps) {
      var m = lab.length,
        currT = 1.0,
        initialT = 1.0;

      for (var i = 0; i < nsweeps; i++) {
        for (var j = 0; j < m; j++) {
          if (Math.random() < 0.5) mcmove(currT);
          else mcrotate(currT);
        }
        currT = cooling_schedule(currT, initialT, nsweeps);
      }

      for (i = 0; i < m; i++) {
        for (j = 0; j < m; j++) {
          if (i != j) {
            checkDist(lab[i], lab[j]);
          }
        }
        if (lab[i].count === m - 1) lab[i].showLine = false;
        else lab[i].showLine = true;
      }
    };

    // check distance between two labels
    var checkDist = function(lab1, lab2) {
      var d11 = lineDist(lab1.x, lab1.y, lab2.x, lab2.y);
      var d12 = lineDist(lab1.x, lab1.y, lab2.x + lab2.width, lab2.y);
      var d21 = lineDist(lab1.x + lab1.width, lab1.y, lab2.x, lab2.y);
      var d22 = lineDist(lab1.x + lab1.width, lab1.y, lab2.x + lab2.width, lab2.y);

      if (d11 >= labelDist && d12 >= labelDist && d21 >= labelDist && d22 >= labelDist) lab1.count++;
    };

    // calculate distance between two points
    var lineDist = function(x, y, x0, y0) {
      return Math.sqrt((x -= x0) * x + (y -= y0) * y);
    };

    // users insert graph width
    labeler.width = function(x) {
      if (!arguments.length) return w;
      w = x;
      return labeler;
    };

    // users insert padding
    labeler.padding = function(pl, pr, pt, pb) {
      if (!arguments.length) return null;
      pL = pl;
      pR = pr;
      pT = pt;
      pB = pb;
      return labeler;
    };

    // users insert distance to check for neighboring labels
    labeler.displayLines = function(x) {
      if (!arguments.length) return labelDist;
      labelDist = x;
      return labeler;
    };

    // users insert graph height
    labeler.height = function(x) {
      if (!arguments.length) return h;
      h = x;
      return labeler;
    };

    // users insert label positions
    labeler.label = function(x) {
      if (!arguments.length) return lab;
      lab = x;
      return labeler;
    };

    // users insert anchor positions
    labeler.anchor = function(x) {
      if (!arguments.length) return anc;
      anc = x;
      return labeler;
    };

    // user defined energy
    labeler.alt_energy = function(x) {
      if (!arguments.length) return energy;
      user_defined_energy = x;
      user_energy = true;
      return labeler;
    };

    // user defined cooling_schedule
    labeler.alt_schedule = function(x) {
      if (!arguments.length) return cooling_schedule;
      user_defined_schedule = x;
      user_schedule = true;
      return labeler;
    };

    return labeler;
  };
})();

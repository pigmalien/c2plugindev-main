// ECMAScript 5 strict mode
"use strict";

assert2(cr, "cr namespace not created");
assert2(cr.plugins_, "cr.plugins_ not created");

/////////////////////////////////////
// Plugin class
// *** CHANGE THE PLUGIN ID HERE *** - must match the "id" property in edittime.js
//          vvvvvvvv
cr.plugins_.RibbonTrail = function (runtime) {
	this.runtime = runtime;
};

(function () {
	/////////////////////////////////////
	// *** CHANGE THE PLUGIN ID HERE *** - must match the "id" property in edittime.js
	//                            vvvvvvvv
	var pluginProto = cr.plugins_.RibbonTrail.prototype;

	/////////////////////////////////////
	// Object type class
	pluginProto.Type = function (plugin) {
		this.plugin = plugin;
		this.runtime = plugin.runtime;
	};

	var typeProto = pluginProto.Type.prototype;

	// called on startup for each object type
	typeProto.onCreate = function () {
		if (this.is_family) return;
		this.texture_img = new Image();
		this.texture_img.src = this.texture_file;
	};

	/////////////////////////////////////
	// Instance class
	pluginProto.Instance = function (type) {
		this.type = type;
		this.runtime = type.runtime;

		// Initialize history array
		this.pointHistory = [];
	};

	var instanceProto = pluginProto.Instance.prototype;

	// called whenever an instance is created
	instanceProto.onCreate = function () {
		// Properties
		this.ribbonWidth = this.properties[0];
		this.trailLifespan = this.properties[1];
		// Replaced textScrollSpeed with logic optimized static tiling

		// Turn on ticking for garbage collection
		this.runtime.tickMe(this);
	};

	instanceProto.onDestroy = function () {
		this.pointHistory = [];
	};

	instanceProto.saveToJSON = function () {
		return {
			"ph": this.pointHistory
		};
	};

	instanceProto.loadFromJSON = function (o) {
		this.pointHistory = o["ph"] || [];
	};

	instanceProto.tick = function () {
		var now = this.runtime.kahanTime.sum;
		// Garbage Collection: remove old points
		for (var i = this.pointHistory.length - 1; i >= 0; i--) {
			if (now - this.pointHistory[i].time > this.trailLifespan) {
				this.pointHistory.splice(i, 1);
			} else {
				break;
			}
		}

		// Update Bounding Box to encompass the entire trail
		if (this.pointHistory.length > 0) {
			var minX = this.pointHistory[0].x;
			var minY = this.pointHistory[0].y;
			var maxX = minX;
			var maxY = minY;

			var r = this.ribbonWidth; // overestimate padding

			for (var j = 1; j < this.pointHistory.length; j++) {
				var p = this.pointHistory[j];
				if (p.x < minX) minX = p.x;
				if (p.x > maxX) maxX = p.x;
				if (p.y < minY) minY = p.y;
				if (p.y > maxY) maxY = p.y;
			}

			// Apply simple padding for width
			this.bbox.set(minX - r, minY - r, maxX + r, maxY + r);
			this.set_bbox_changed();
		}

		this.runtime.redraw = true;
	};

	instanceProto.draw = function (ctx) {
		// 2D canvas fallback (optional, not requested, but good for stability)
	};

	instanceProto.drawGL = function (glw) {
		// Use glw.quad processing.
		var count = this.pointHistory.length;
		if (count < 2) return;

		// Setup texture
		var tex = this.webGL_texture;

		// Lazy-load type texture if instance has none
		if (!tex) {
			var type = this.type;
			if (type.webGL_texture) {
				tex = type.webGL_texture;
			} else if (type.texture_img && type.texture_img.complete) {
				// Load into WebGL
				type.webGL_texture = this.runtime.glwrap.loadTexture(type.texture_img, false, this.runtime.linearSampling, this.type.texture_pixelformat);
				tex = type.webGL_texture;
			}
		}

		if (tex) {
			glw.setTexture(tex);
		} else {
			// No texture warning (removed infinite spam)
		}

		var now = this.runtime.kahanTime.sum;
		var points = this.pointHistory;

		// OPTIMIZATION:
		// Normals are now cached in pointHistory during UpdateTrailPosition.
		// We only calculate W (Width) and Alpha here.

		var objectOpacity = this.opacity;

		// Loop through segments
		for (var i = 0; i < count - 1; i++) {
			var p1 = points[i];
			var p2 = points[i + 1];

			// Reconstruct geometry on the fly using cached normals
			// p1.nx, p1.ny must exist.

			// Fallback for missing normals (if old points exist before optimization)
			// But user reloads, so clean start.

			// 1. Calculate Widths and Alphas
			var age1 = now - p1.time;
			var lifeRatio1 = 1.0 - (age1 / this.trailLifespan);
			if (lifeRatio1 < 0) lifeRatio1 = 0; if (lifeRatio1 > 1) lifeRatio1 = 1;

			var w1 = this.ribbonWidth * lifeRatio1;
			var hw1 = w1 * 0.5;

			var age2 = now - p2.time;
			var lifeRatio2 = 1.0 - (age2 / this.trailLifespan);
			if (lifeRatio2 < 0) lifeRatio2 = 0; if (lifeRatio2 > 1) lifeRatio2 = 1;

			var w2 = this.ribbonWidth * lifeRatio2;
			var hw2 = w2 * 0.5;

			var alpha = (lifeRatio1 + lifeRatio2) * 0.5 * objectOpacity;

			// 2. Vertex positions
			// P1
			var l1x = p1.x + p1.nx * hw1;
			var l1y = p1.y + p1.ny * hw1;
			var r1x = p1.x - p1.nx * hw1;
			var r1y = p1.y - p1.ny * hw1;

			// P2
			var l2x = p2.x + p2.nx * hw2;
			var l2y = p2.y + p2.ny * hw2;
			var r2x = p2.x - p2.nx * hw2;
			var r2y = p2.y - p2.ny * hw2;

			// 3. Draw Quad
			// Order: TL, TR, BR, BL
			glw.quad(l1x, l1y, r1x, r1y, r2x, r2y, l2x, l2y, alpha);
		}
	};

	//////////////////////////////////////
	// Conditions
	function Cnds() { };
	pluginProto.cnds = new Cnds();

	//////////////////////////////////////
	// Actions
	function Acts() { };

	Acts.prototype.UpdateTrailPosition = function (x, y) {
		// Minimum distance check
		if (this.pointHistory.length > 0) {
			var last = this.pointHistory[0];
			var dx = x - last.x;
			var dy = y - last.y;
			if (dx * dx + dy * dy < 2) return;
		}

		var now = this.runtime.kahanTime.sum;
		if (isNaN(now)) now = 0;

		// Create new point object
		var newP = { x: x, y: y, time: now, nx: 0, ny: 0 };

		// Add to history
		this.pointHistory.unshift(newP);

		// Calculate Normal for newP (Head) and Update previous Head
		var count = this.pointHistory.length;
		if (count >= 2) {
			var p0 = this.pointHistory[0]; // New
			var p1 = this.pointHistory[1]; // Old Head

			// Calculate direction P0 -> P1
			var dx = p1.x - p0.x;
			var dy = p1.y - p0.y;
			var len = Math.sqrt(dx * dx + dy * dy);
			if (len > 0.001) { dx /= len; dy /= len; }
			else { dx = 1; dy = 0; }

			// Normal is (-dy, dx)
			p0.nx = -dy;
			p0.ny = dx;

			// For P1 (Middle point now? Or just End?)
			// If p1 was previously connecting to p2, we average it.
			// If count == 2, p1 is Tail. Tail normal matches segment.
			if (count > 2) {
				var p2 = this.pointHistory[2];
				// Vector P1 -> P2
				var dx2 = p2.x - p1.x;
				var dy2 = p2.y - p1.y;
				var len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
				if (len2 > 0.001) { dx2 /= len2; dy2 /= len2; }

				// Average direction (Angle bisector approximation)
				var adx = (dx + dx2);
				var ady = (dy + dy2);
				var alen = Math.sqrt(adx * adx + ady * ady);
				if (alen > 0.001) { adx /= alen; ady /= alen; }

				// Normal
				p1.nx = -ady;
				p1.ny = adx;
			} else {
				// If only 2 points, P1 gets same normal as segment P0->P1
				p1.nx = -dy;
				p1.ny = dx;
			}
		}

		this.runtime.redraw = true;
	};

	pluginProto.acts = new Acts();

	//////////////////////////////////////
	// Expressions
	function Exps() { };
	pluginProto.exps = new Exps();

}());
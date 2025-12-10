// ECMAScript 5 strict mode
"use strict";

assert2(cr, "cr namespace not created");
assert2(cr.behaviors, "cr.behaviors not created");

/////////////////////////////////////
// Behavior class
// *** CHANGE THE BEHAVIOR ID HERE *** - must match the "id" property in edittime.js
//           vvvvvvvvvv
cr.behaviors.TileToPath = function (runtime) {
	this.runtime = runtime;
};

(function () {
	// *** CHANGE THE BEHAVIOR ID HERE *** - must match the "id" property in edittime.js
	//                               vvvvvvvvvv
	var behaviorProto = cr.behaviors.TileToPath.prototype;

	/////////////////////////////////////
	// Behavior type class
	behaviorProto.Type = function (behavior, objtype) {
		this.behavior = behavior;
		this.objtype = objtype;
		this.runtime = behavior.runtime;
	};

	var behtypeProto = behaviorProto.Type.prototype;

	behtypeProto.onCreate = function () {
	};

	/////////////////////////////////////
	// Behavior instance class
	behaviorProto.Instance = function (type, inst) {
		this.type = type;
		this.behavior = type.behavior;
		this.inst = inst;				// associated object instance to modify
		this.runtime = type.runtime;

		this.stack = [];
		this.currentMove = null;
		this.subTarget = null;
		this.isMoving = false;
		this.pathTotalSize = 0;
		this.originalPath = [];
	};

	var behinstProto = behaviorProto.Instance.prototype;

	behinstProto.onCreate = function () {
		// Load properties
		this.tileW = this.properties[0];
		this.tileH = this.properties[1];
		this.speed = this.properties[2];
		this.allowDiagonals = (this.properties[3] !== 0);
	};

	behinstProto.onDestroy = function () {
	};

	// called when saving the full state of the game
	behinstProto.saveToJSON = function () {
		return {
			"stack": this.stack,
			"currentMove": this.currentMove,
			"subTarget": this.subTarget,
			"isMoving": this.isMoving,
			"isRunning": this.isRunning,
			"pathTotalSize": this.pathTotalSize,
			"originalPath": this.originalPath
		};
	};

	// called when loading the full state of the game
	behinstProto.loadFromJSON = function (o) {
		this.stack = o["stack"] || [];
		this.currentMove = o["currentMove"] || null;
		this.subTarget = o["subTarget"] || null;
		this.isMoving = o["isMoving"] || false;
		this.isRunning = o["isRunning"] || false;
		this.pathTotalSize = o["pathTotalSize"] || 0;
		this.originalPath = o["originalPath"] || [];
	};

	behinstProto.tick = function () {
		var dt = this.runtime.getDt(this.inst);

		if (this.isRunning && !this.currentMove && this.stack.length > 0) {
			this.currentMove = this.stack.shift();
			this.isMoving = true;
			this.subTarget = null;
		}

		if (this.currentMove) {
			// If we don't have an immediate sub-target, calculate the next tile step
			if (!this.subTarget) {
				var cx = Math.floor(this.inst.x / this.tileW);
				var cy = Math.floor(this.inst.y / this.tileH);

				// Check if we reached the major target
				if (cx === this.currentMove.tx && cy === this.currentMove.ty) {
					// Ensure exact final snap
					this.inst.x = this.currentMove.wx;
					this.inst.y = this.currentMove.wy;
					this.inst.set_bbox_changed();

					this.currentMove = null;

					if (this.stack.length === 0) {
						this.isMoving = false;
						this.isRunning = false;
						this.runtime.trigger(cr.behaviors.TileToPath.prototype.cnds.OnPathFinished, this.inst);
					}
					return;
				}

				// Calculate direction to target
				var dx = this.currentMove.tx - cx;
				var dy = this.currentMove.ty - cy;
				var nx = cx;
				var ny = cy;

				if (this.allowDiagonals) {
					if (dx !== 0) nx += (dx > 0 ? 1 : -1);
					if (dy !== 0) ny += (dy > 0 ? 1 : -1);
				}
				else {
					// No diagonals: move along one axis at a time
					if (dx !== 0) nx += (dx > 0 ? 1 : -1);
					else if (dy !== 0) ny += (dy > 0 ? 1 : -1);
				}

				this.subTarget = {
					wx: (nx * this.tileW) + (this.tileW / 2),
					wy: (ny * this.tileH) + (this.tileH / 2),
					tx: nx,
					ty: ny
				};
			}

			// Move towards subTarget
			if (this.subTarget) {
				var tx = this.subTarget.wx;
				var ty = this.subTarget.wy;
				var dx = tx - this.inst.x;
				var dy = ty - this.inst.y;
				var dist = Math.sqrt(dx * dx + dy * dy);
				var step = this.speed * dt;

				if (dist <= step) {
					// Arrival at sub-target (tile center)
					this.inst.x = tx;
					this.inst.y = ty;
					this.inst.set_bbox_changed();

					this.runtime.trigger(cr.behaviors.TileToPath.prototype.cnds.OnNewTileReached, this.inst);

					this.subTarget = null; // Forces calculation of next step in next frame
				}
				else {
					// Move
					// var angle = Math.atan2(dy, dx);
					var angle = Math.atan2(dy, dx);
					this.inst.x += Math.cos(angle) * step;
					this.inst.y += Math.sin(angle) * step;
					this.inst.set_bbox_changed();
				}
			}
		}
	};

	/**BEGIN-PREVIEWONLY**/
	behinstProto.getDebuggerValues = function (propsections) {
		propsections.push({
			"title": this.type.name,
			"properties": [
				{ "name": "Stack Count", "value": this.stack.length },
				{ "name": "Is Moving", "value": this.isMoving },
				{ "name": "Is Running", "value": this.isRunning },
				{ "name": "Target X", "value": (this.currentMove ? this.currentMove.tx : 0) },
				{ "name": "Target Y", "value": (this.currentMove ? this.currentMove.ty : 0) }
			]
		});
	};

	behinstProto.onDebugValueEdited = function (header, name, value) {
	};
	/**END-PREVIEWONLY**/

	//////////////////////////////////////
	// Conditions
	function Cnds() { };

	Cnds.prototype.OnPathFinished = function () {
		return true;
	};

	Cnds.prototype.OnNewTileReached = function () {
		return true;
	};

	Cnds.prototype.IsMoving = function () {
		return this.isMoving;
	};

	behaviorProto.cnds = new Cnds();

	//////////////////////////////////////
	// Actions
	function Acts() { };

	Acts.prototype.AddTile = function (ix, iy) {
		var wx = (ix * this.tileW) + (this.tileW / 2);
		var wy = (iy * this.tileH) + (this.tileH / 2);

		this.stack.push({
			tx: ix,
			ty: iy,
			wx: wx,
			wy: wy
		});
	};

	Acts.prototype.ClearStack = function () {
		this.stack.length = 0;
		this.originalPath.length = 0;
	};

	Acts.prototype.StopMovement = function () {
		this.stack.length = 0;
		this.currentMove = null;
		this.subTarget = null;
		this.originalPath.length = 0;
		this.isMoving = false;
		this.isRunning = false;
	};

	Acts.prototype.StartPath = function () {
		this.isRunning = true;
		this.pathTotalSize = this.stack.length;
		this.originalPath = this.stack.slice(0);
	};

	behaviorProto.acts = new Acts();

	//////////////////////////////////////
	// Expressions
	function Exps() { };

	Exps.prototype.StackCount = function (ret) {
		ret.set_int(this.stack.length);
	};

	Exps.prototype.TargetX = function (ret) {
		if (this.currentMove)
			ret.set_int(this.currentMove.tx);
		else
			ret.set_int(-1);
	};

	Exps.prototype.TargetY = function (ret) {
		if (this.currentMove)
			ret.set_int(this.currentMove.ty);
		else
			ret.set_int(-1);
	};

	Exps.prototype.WorldToTileX = function (ret, x) {
		ret.set_int(Math.floor(x / this.tileW));
	};

	Exps.prototype.WorldToTileY = function (ret, y) {
		ret.set_int(Math.floor(y / this.tileH));
	};

	Exps.prototype.TileToWorldX = function (ret, tx) {
		ret.set_int((tx * this.tileW) + (this.tileW / 2));
	};

	Exps.prototype.TileToWorldY = function (ret, ty) {
		ret.set_int((ty * this.tileH) + (this.tileH / 2));
	};

	Exps.prototype.CurrentIndex = function (ret) {
		if (this.currentMove)
			ret.set_int(this.pathTotalSize - this.stack.length - 1);
		else
			ret.set_int(-1);
	};

	Exps.prototype.PathXAtIndex = function (ret, index) {
		index = Math.floor(index);
		if (index >= 0 && index < this.originalPath.length) {
			ret.set_int(this.originalPath[index].tx);
		} else {
			ret.set_int(-1);
		}
	};

	Exps.prototype.PathYAtIndex = function (ret, index) {
		index = Math.floor(index);
		if (index >= 0 && index < this.originalPath.length) {
			ret.set_int(this.originalPath[index].ty);
		} else {
			ret.set_int(-1);
		}
	};

	behaviorProto.exps = new Exps();

}());
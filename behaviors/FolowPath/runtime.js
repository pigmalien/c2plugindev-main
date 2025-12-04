// ECMAScript 5 strict mode
"use strict";

assert2(cr, "cr namespace not created");
assert2(cr.behaviors, "cr.behaviors not created");

/////////////////////////////////////
// Behavior class
// *** The behavior ID must match the "id" property in edittime.js ***
cr.behaviors.FollowPath = function(runtime)
{
	this.runtime = runtime;
};

(function ()
{
	// *** The behavior ID must match the "id" property in edittime.js ***
	var behaviorProto = cr.behaviors.FollowPath.prototype;
		
	/////////////////////////////////////
	// Behavior type class
	behaviorProto.Type = function(behavior, objtype)
	{
		this.behavior = behavior;
		this.objtype = objtype;
		this.runtime = behavior.runtime;
	};
	
	var behtypeProto = behaviorProto.Type.prototype;

	behtypeProto.onCreate = function()
	{
	};

	/////////////////////////////////////
	// Behavior instance class
	behaviorProto.Instance = function(type, inst)
	{
		this.type = type;
		this.behavior = type.behavior;
		this.inst = inst;				// associated object instance to modify
		this.runtime = type.runtime;
	};
	
	var behinstProto = behaviorProto.Instance.prototype;

	behinstProto.onCreate = function()
	{
		// Load properties
		this.speed = this.properties[0];
		this.accel = this.properties[1];
		this.decel = this.properties[2];
		this.rounding = this.properties[3];

		// Behavior state
		this.active = false;
		this.path = [];
		this.currentNode = 0;
		this.currentSpeed = 0;
		this.targetSpeed = 0;

		// State for pre-calculated curve path
		this.bakedPath = [];
		this.pathLength = 0;
		this.distanceTraveled = 0;
		this.bakeQuality = 100; // Segments per node pair
	};
	
	behinstProto.onDestroy = function ()
	{
		// called when associated object is being destroyed
		// note runtime may keep the object and behavior alive after this call for recycling;
		// release, recycle or reset any references here as necessary
	};
	
	// called when saving the full state of the game
	behinstProto.saveToJSON = function ()
	{
		// return a Javascript object containing information about your behavior's state
		// note you MUST use double-quote syntax (e.g. "property": value) to prevent
		// Closure Compiler renaming and breaking the save format
		return {
			"s": this.speed,
			"a": this.accel,
			"d": this.decel,
			"r": this.rounding,
			"act": this.active,
			"path": this.path,
			"cn": this.currentNode,
			"cs": this.currentSpeed,
			"ts": this.targetSpeed,
			"bp": this.bakedPath,
			"pl": this.pathLength,
			"dt": this.distanceTraveled
		};
	};
	
	// called when loading the full state of the game
	behinstProto.loadFromJSON = function (o)
	{
		// load from the state previously saved by saveToJSON
		this.speed = o["s"];
		this.accel = o["a"];
		this.decel = o["d"];
		this.rounding = o["r"];
		this.active = o["act"];
		this.path = o["path"];
		this.currentNode = o["cn"];
		this.currentSpeed = o["cs"];
		this.targetSpeed = o["ts"];
		this.bakedPath = o["bp"] || [];
		this.pathLength = o["pl"] || 0;
		this.distanceTraveled = o["dt"] || 0;
	};

	behinstProto.tick = function ()
	{
		var dt = this.runtime.getDt(this.inst);
		if (dt === 0)
			return;

		// Apply acceleration/deceleration
		if (this.active)
		{
			if (this.currentSpeed < this.targetSpeed) // Need to accelerate
				this.currentSpeed = Math.min(this.currentSpeed + this.accel * dt, this.targetSpeed);
			else if (this.currentSpeed > this.targetSpeed) // Need to decelerate
				this.currentSpeed = Math.max(this.currentSpeed - this.decel * dt, this.targetSpeed);
			// else (this.currentSpeed === this.targetSpeed), do nothing
		}

		// Correct deceleration logic for a baked path
		if (this.active && this.decel > 0)
		{
			// v^2 = u^2 + 2as  =>  0 = u^2 - 2as  =>  u = sqrt(2as)
			// where u is speed, a is decel, s is distance remaining
			var distRemaining = this.pathLength - this.distanceTraveled;
			var requiredSpeed = Math.sqrt(2 * this.decel * distRemaining);
			
			if (this.currentSpeed > requiredSpeed)
				this.currentSpeed = requiredSpeed;
		}


		if (!this.active || this.currentSpeed === 0)
			return;

		this.distanceTraveled += this.currentSpeed * dt;

		if (this.distanceTraveled >= this.pathLength) {
			// Path finished
			this.distanceTraveled = this.pathLength;
			var finalBakedPoint = this.bakedPath[this.bakedPath.length - 1];
			if (finalBakedPoint) {
				this.inst.x = finalBakedPoint.x;
				this.inst.y = finalBakedPoint.y;
			}
			this.active = false;
			this.currentSpeed = 0;
			this.targetSpeed = 0;
			this.runtime.trigger(cr.behaviors.FollowPath.prototype.cnds.OnPathFinished, this.inst);
		} else {
			// Find position on the baked path
			var pos = this.getPositionAtDistance(this.distanceTraveled);
			this.inst.x = pos.x;
			this.inst.y = pos.y;
			
			// Update currentNode for expression, purely for user feedback
			this.currentNode = Math.floor(pos.nodeIndex);
		}

		var inst = this.inst;
		inst.set_bbox_changed();
	};
	
	// Helper to get position on the pre-calculated path
	behinstProto.getPositionAtDistance = function(dist) {
		if (this.bakedPath.length < 2) return {x: this.inst.x, y: this.inst.y, nodeIndex: 0};
		
		for (var i = 1; i < this.bakedPath.length; i++) {
			if (this.bakedPath[i].dist >= dist) {
				var p1 = this.bakedPath[i-1];
				var p2 = this.bakedPath[i];
				var t = (dist - p1.dist) / (p2.dist - p1.dist);
				return { x: cr.lerp(p1.x, p2.x, t), y: cr.lerp(p1.y, p2.y, t), nodeIndex: p1.nodeIndex + t };
			}
		}
		var last = this.bakedPath[this.bakedPath.length - 1];
		return { x: last.x, y: last.y, nodeIndex: last.nodeIndex };
	};

	/**BEGIN-PREVIEWONLY**/
	behinstProto.getDebuggerValues = function (propsections)
	{
		// Append to propsections any debugger sections you want to appear.
		// Each section is an object with two members: "title" and "properties".
		// "properties" is an array of individual debugger properties to display
		// with their name and value, and some other optional settings.
		propsections.push({
			"title": this.type.name,
			"properties": [
				{"name": "Is active", "value": this.active, "readonly": true},
				{"name": "Speed", "value": this.speed},
				{"name": "Current Speed", "value": this.currentSpeed, "readonly": true},
				{"name": "Acceleration", "value": this.accel},
				{"name": "Deceleration", "value": this.decel},
				{"name": "Corner Rounding", "value": this.rounding},
				{"name": "Path nodes", "value": this.path.length, "readonly": true},
				{"name": "Current node", "value": this.currentNode, "readonly": true}
			]
		});
	};
	
	behinstProto.onDebugValueEdited = function (header, name, value)
	{
		// Called when a non-readonly property has been edited in the debugger. Usually you only
		// will need 'name' (the property name) and 'value', but you can also use 'header' (the
		// header title for the section) to distinguish properties with the same name.		
		if (name === "Speed")
			this.speed = value;
		else if (name === "Acceleration")
			this.accel = value;
		else if (name === "Deceleration")
			this.decel = value;
		else if (name === "Corner Rounding")
			this.rounding = value;
	};
	/**END-PREVIEWONLY**/

	//////////////////////////////////////
	// Conditions
	function Cnds() {};

	Cnds.prototype.OnPathFinished = function () { return true; };
	Cnds.prototype.IsMoving = function () { return this.active; };
	
	behaviorProto.cnds = new Cnds();

	//////////////////////////////////////
	// Actions
	function Acts() {};

	Acts.prototype.AddNode = function (x, y)
	{
		this.path.push({ "x": x, "y": y });
	};

	Acts.prototype.ClearPath = function ()
	{
		this.path.length = 0;
		this.active = false; // Stop movement if path is cleared
		this.currentNode = 0;
		this.currentSpeed = 0;
		this.targetSpeed = 0;
	};

	Acts.prototype.StartPath = function ()
	{
		if (this.path.length < 1)
			return;
		
		this.bakePath(); // Pre-calculate the full path

		this.distanceTraveled = 0;
		this.active = true;
		this.currentNode = 0;
		this.targetSpeed = this.speed;

		// If no acceleration, start at full speed immediately
		if (this.accel === 0)
			this.currentSpeed = this.speed;
		else
			this.currentSpeed = 0; // Always start from 0 if accelerating
		
		// Snap to start of path
		if (this.bakedPath.length > 0) {
			this.inst.x = this.bakedPath[0].x;
			this.inst.y = this.bakedPath[0].y;
		}
	};

	// Path baking function
	behinstProto.bakePath = function() {
		this.bakedPath = [];
		this.pathLength = 0;
		if (this.path.length < 1) return;

		var totalDist = 0;
		var lastPos = this.path[0];
		this.bakedPath.push({x: lastPos.x, y: lastPos.y, dist: 0, nodeIndex: 0});

		for (var i = 0; i < this.path.length - 1; i++) {
			var p0 = (i > 0) ? this.path[i-1] : this.path[i];
			var p1 = this.path[i];
			var p2 = this.path[i+1];
			
			for (var j = 1; j <= this.bakeQuality; j++) {
				var t = j / this.bakeQuality;
				var curPos;

				// Only apply quadratic curve if rounding is enabled and we have enough points for a curve
				if (this.rounding > 0 && this.path.length > 2) {
					// To create a curve from p1 to p2, we need p0, p1, p2, and p3 (for the next segment)
					// We will create a curve from the midpoint of p0-p1 to the midpoint of p1-p2, with p1 as the control point.
					var p3 = (i < this.path.length - 2) ? this.path[i+2] : p2;
					
					var startX = cr.lerp(p0.x, p1.x, 0.5);
					var startY = cr.lerp(p0.y, p1.y, 0.5);
					var endX = cr.lerp(p1.x, p2.x, 0.5);
					var endY = cr.lerp(p1.y, p2.y, 0.5);
					
					// Quadratic Bezier from start to end with p1 as control
					var bez_x = Math.pow(1-t, 2) * startX + 2 * (1-t) * t * p1.x + Math.pow(t, 2) * endX;
					var bez_y = Math.pow(1-t, 2) * startY + 2 * (1-t) * t * p1.y + Math.pow(t, 2) * endY;
					curPos = { x: bez_x, y: bez_y };
				} else {
					// Linear interpolation for sharp corners
					curPos = { x: cr.lerp(p1.x, p2.x, t), y: cr.lerp(p1.y, p2.y, t) };
				}

				totalDist += cr.distanceTo(lastPos.x, lastPos.y, curPos.x, curPos.y);
				this.bakedPath.push({x: curPos.x, y: curPos.y, dist: totalDist, nodeIndex: i + t});
				lastPos = curPos;
			}
		}
		this.pathLength = totalDist;
	};

	Acts.prototype.Stop = function ()
	{
		this.active = false;
		this.currentSpeed = 0;
		this.targetSpeed = 0;
	};

	Acts.prototype.SetSpeed = function (s)
	{
		this.speed = s;
		if (this.active)
			this.targetSpeed = s; // Only update target speed if actively moving
	};

	Acts.prototype.SetAcceleration = function (a)
	{
		this.accel = a;
	};

	Acts.prototype.SetDeceleration = function (d)
	{
		this.decel = d;
	};

	Acts.prototype.SetRounding = function (r)
	{
		this.rounding = r;
	};
	
	behaviorProto.acts = new Acts();

	//////////////////////////////////////
	// Expressions
	function Exps() {};
	
	Exps.prototype.CurrentSpeed = function (ret)
	{
		ret.set_float(this.currentSpeed);
	};
	
	Exps.prototype.PathNodeCount = function (ret)
	{
		ret.set_int(this.path.length);
	};
	
	Exps.prototype.CurrentNode = function (ret)
	{
		ret.set_int(this.currentNode);
	};
	
	behaviorProto.exps = new Exps();
	
}());
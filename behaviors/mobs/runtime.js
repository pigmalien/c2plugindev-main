// ECMAScript 5 strict mode
"use strict";

assert2(cr, "cr namespace not created");
assert2(cr.behaviors, "cr.behaviors not created");

/////////////////////////////////////
// Behavior class
// *** CHANGE THE BEHAVIOR ID HERE *** - must match the "id" property in edittime.js
//           vvvvvvvvvvvv
cr.behaviors.MobsMovement = function(runtime)
{
	this.runtime = runtime;
};

(function ()
{
	// *** CHANGE THE BEHAVIOR ID HERE *** - must match the "id" property in edittime.js
	//                               vvvvvvvvvvvv
	var behaviorProto = cr.behaviors.MobsMovement.prototype;
		
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
		// This is a shared property for all instances of this behavior.
		// It stores the UID of the target instance.
		this.targetUid = -1; 

		// This will hold the final movement vector for each mover instance.
		this.forces = {}; // Using an object with UIDs as keys
		this.obstacleTypes = [];
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
		// Load properties from edittime.js
		this.isActive = (this.properties[0] === 0); // 0=Active, 1=Inactive
		this.maxSpeed = this.properties[1];
		this.rotationSpeed = this.properties[2]; // 0=none
		this.flipMode = this.properties[3];      // 0=None, 1=Horizontal
		this.repulsionRadius = this.properties[4];
		this.repulsionForce = this.properties[5];
		
		// object is sealed after this call, so make sure any properties you'll ever need are created, e.g.
		// This will be calculated once per tick for this instance
		this.repulsionRadiusSq = this.repulsionRadius * this.repulsionRadius;

		// For restoring width when flipping
		this.lastKnownWidth = this.inst.width;
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
			"tuid": this.type.targetUid,
			"isActive": this.isActive
		};
	};
	
	// called when loading the full state of the game
	behinstProto.loadFromJSON = function (o)
	{
		// load from the state previously saved by saveToJSON
		// 'o' provides the same object that you saved, e.g.
		this.type.targetUid = o["tuid"];
		this.isActive = o["isActive"];
		// note you MUST use double-quote syntax (e.g. o["property"]) to prevent
		// Closure Compiler renaming and breaking the save format
	};

	behinstProto.tick = function ()
	{
		// This is the first instance being ticked this frame.
		// We run the force calculation for all instances here, once per tick.
		if (!this.isActive)
			return;
			
		if (this.runtime.tickcount !== this.type.lastTick) {
			this.type.lastTick = this.runtime.tickcount;
			this.calculateAllForces();
		}
	};

	behinstProto.tick2 = function ()
	{
		// Apply the pre-calculated forces.
		// tick2 runs after tick, ensuring all forces are calculated before they are applied.
		if (!this.isActive)
			return;
			
		var dt = this.runtime.getDt(this.inst);
		var uid = this.inst.uid;
		var force = this.type.forces[uid];

		if (!force) return;

		// Normalize the final force vector to ensure consistent speed.
		var forceMagnitude = Math.sqrt(force.x * force.x + force.y * force.y);
		if (forceMagnitude > 0) {
			var finalForceX = (force.x / forceMagnitude);
			var finalForceY = (force.y / forceMagnitude);

			// Apply movement based on the final force, max speed, and delta-time.
			var oldx = this.inst.x;
			var oldy = this.inst.y;

			this.inst.x += finalForceX * this.maxSpeed * dt;
			this.inst.set_bbox_changed();
			if (this.testObstacleOverlap()) {
				this.inst.x = oldx;
				this.inst.set_bbox_changed();
			}

			this.inst.y += finalForceY * this.maxSpeed * dt;
			this.inst.set_bbox_changed();
			if (this.testObstacleOverlap()) {
				this.inst.y = oldy;
				this.inst.set_bbox_changed();
			}

			// Update angle or flip based on properties
			if (this.rotationSpeed > 0)
			{
				// Smoothly rotate the mover to face its direction of travel.
				var targetAngle = Math.atan2(finalForceY, finalForceX);
				this.inst.angle = cr.anglelerp(this.inst.angle, targetAngle, this.rotationSpeed * dt);
			}
			else if (this.flipMode === 1) // 1=Horizontal
			{
				// Store the object's actual width if it's not currently flipped
				if (this.inst.width > 0)
				{
					this.lastKnownWidth = this.inst.width;
				}
				
				// Flip based on horizontal direction (with a small threshold to prevent rapid flipping)
				if (finalForceX < -0.01)
					this.inst.width = -this.lastKnownWidth;
				else if (finalForceX > 0.01)
					this.inst.width = this.lastKnownWidth;
			}

			this.inst.set_bbox_changed();
		}
	};

	behinstProto.calculateAllForces = function()
	{
		var target = this.runtime.getObjectByUID(this.type.targetUid);
		var movers = this.type.objtype.instances;
		var forces = this.type.forces;

		// Clear previous forces
		for (var uid in forces) {
			if (forces.hasOwnProperty(uid)) {
				delete forces[uid];
			}
		}

		if (!target || movers.length === 0) {
			return;
		}

		for (var i = 0; i < movers.length; i++) {
			var moverA = movers[i];
			
			// Find the correct behavior instance for this mover
			var behA = null;
			for (var b = 0; b < moverA.behavior_insts.length; b++) {
				if (moverA.behavior_insts[b].type === this.type) {
					behA = moverA.behavior_insts[b];
					break;
				}
			}

			if (!behA || !behA.isActive)
				continue;

			var totalForceX = 0;
			var totalForceY = 0;

			// A. Steering Force (towards target)
			var angleToTarget = cr.angleTo(moverA.x, moverA.y, target.x, target.y);
			totalForceX += Math.cos(angleToTarget);
			totalForceY += Math.sin(angleToTarget);

			// B. Repulsion Force (from other movers)
			for (var j = 0; j < movers.length; j++) {
				if (i === j) continue;

				var moverB = movers[j];
				
				// Also skip inactive movers for repulsion checks
				if (!moverB.behavior_insts[0].isActive)
					continue;
					
				var dx = moverB.x - moverA.x;
				var dy = moverB.y - moverA.y;
				var distSq = (dx * dx) + (dy * dy);

				if (distSq > 0 && distSq < behA.repulsionRadiusSq) {
					var dist = Math.sqrt(distSq);
					var forceMagnitude = (behA.repulsionRadius - dist) / behA.repulsionRadius;
					totalForceX -= (dx / dist) * forceMagnitude * behA.repulsionForce;
					totalForceY -= (dy / dist) * forceMagnitude * behA.repulsionForce;
				}
			}

			// C. Obstacle Avoidance
			for (var k = 0; k < this.type.obstacleTypes.length; k++) {
				var obstacleType = this.type.obstacleTypes[k];
				var obstacles = obstacleType.instances;
				for (var m = 0; m < obstacles.length; m++) {
					var obstacle = obstacles[m];
					
					var dx = obstacle.x - moverA.x;
					var dy = obstacle.y - moverA.y;
					var distSq = (dx * dx) + (dy * dy);

					if (distSq > 0 && distSq < behA.repulsionRadiusSq) {
						var dist = Math.sqrt(distSq);
						var forceMagnitude = (behA.repulsionRadius - dist) / behA.repulsionRadius;
						totalForceX -= (dx / dist) * forceMagnitude * behA.repulsionForce;
						totalForceY -= (dy / dist) * forceMagnitude * behA.repulsionForce;
					}
				}
			}

			forces[moverA.uid] = { x: totalForceX, y: totalForceY };
		}
	};

	behinstProto.testObstacleOverlap = function()
	{
		for (var k = 0; k < this.type.obstacleTypes.length; k++) {
			var obstacleType = this.type.obstacleTypes[k];
			var obstacles = obstacleType.instances;
			for (var m = 0; m < obstacles.length; m++) {
				if (this.runtime.testOverlap(this.inst, obstacles[m]))
					return true;
			}
		}
		return false;
	};
	
	// The comments around these functions ensure they are removed when exporting, since the
	// debugger code is no longer relevant after publishing.
	/**BEGIN-PREVIEWONLY**/
	behinstProto.getDebuggerValues = function (propsections)
	{
		var targetInst = this.runtime.getObjectByUID(this.type.targetUid);
		var targetName = targetInst ? targetInst.type.name + " (UID: " + targetInst.uid + ")" : "None";
		
		// Append to propsections any debugger sections you want to appear.
		// Each section is an object with two members: "title" and "properties".
		// "properties" is an array of individual debugger properties to display
		// with their name and value, and some other optional settings.
		propsections.push({
			"title": this.type.name,
			"properties": [
				{"name": "Active", "value": this.isActive, "readonly": true},
				{"name": "Max speed", "value": this.maxSpeed},
				{"name": "Rotation speed", "value": this.rotationSpeed},
				{"name": "Repulsion radius", "value": this.repulsionRadius},
				{"name": "Repulsion force", "value": this.repulsionForce},
				{"name": "Target", "value": targetName, "readonly": true}
			]
		});
	};
	
	behinstProto.onDebugValueEdited = function (header, name, value)
	{
		switch (name) {
			case "Max speed": 		 this.maxSpeed = value; break;
			case "Rotation speed": 	 this.rotationSpeed = value; break;
			case "Repulsion radius": 
				this.repulsionRadius = value; 
				this.repulsionRadiusSq = value * value;
				break;
			case "Repulsion force":  this.repulsionForce = value; break;
		}
	};
	/**END-PREVIEWONLY**/

	//////////////////////////////////////
	// Conditions
	function Cnds() {};
	
	Cnds.prototype.IsActive = function ()
	{
		return this.isActive;
	};
	
	behaviorProto.cnds = new Cnds();

	//////////////////////////////////////
	// Actions
	function Acts() {};
	
	Acts.prototype.SetTarget = function (obj)
	{
		if (!obj) return;
		var inst = obj.getFirstPicked(this.inst);
		if (!inst) return;

		// Store the target's UID. This is shared across all instances of the behavior.
		this.type.targetUid = inst.uid;
	};
	
	Acts.prototype.SetActive = function ()
	{
		this.isActive = true;
	};
	
	Acts.prototype.SetInactive = function ()
	{
		this.isActive = false;
	};
	
	Acts.prototype.SetMaxSpeed = function (s)
	{
		this.maxSpeed = s;
	};

	Acts.prototype.SetRotationSpeed = function (s)
	{
		this.rotationSpeed = s;
	};

	Acts.prototype.SetRepulsionRadius = function (r)
	{
		this.repulsionRadius = r;
		this.repulsionRadiusSq = r * r;
	};

	Acts.prototype.SetRepulsionForce = function (f)
	{
		this.repulsionForce = f;
	};
	
	Acts.prototype.AddObstacle = function (obj)
	{
		if (!obj) return;
		if (this.type.obstacleTypes.indexOf(obj) === -1)
			this.type.obstacleTypes.push(obj);
	};

	Acts.prototype.ClearObstacles = function ()
	{
		this.type.obstacleTypes.length = 0;
	};
	
	// ... other actions here ...
	
	behaviorProto.acts = new Acts();

	//////////////////////////////////////
	// Expressions
	function Exps() {};
	
	behaviorProto.exps = new Exps();
	
}());
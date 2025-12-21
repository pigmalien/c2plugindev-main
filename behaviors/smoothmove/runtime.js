﻿﻿﻿﻿﻿// ECMAScript 5 strict mode
"use strict";

assert2(cr, "cr namespace not created");
assert2(cr.behaviors, "cr.behaviors not created");

/////////////////////////////////////
// Behavior class
// *** CHANGE THE BEHAVIOR ID HERE *** - must match the "id" property in edittime.js
//           vvvvvvvvvv
cr.behaviors.SmoothMove = function(runtime)
{
	this.runtime = runtime;
};

(function ()
{
	// *** CHANGE THE BEHAVIOR ID HERE *** - must match the "id" property in edittime.js
	//                               vvvvvvvvvv
	var behaviorProto = cr.behaviors.SmoothMove.prototype;
		
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
		this.targetUid = -1;
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
		this.enabled = (this.properties[0] === 0); // 0=Enabled, 1=Disabled
		this.movementMode = this.properties[1]; // 0=Steering, 1=Direct
		this.maxSpeed = this.properties[2];
		this.minSpeed = this.properties[3];
		this.deceleration = this.properties[4];
		this.rotationSpeed = this.properties[5];
		this.effectiveRadius = this.properties[6];
		this.stopOnSolids = (this.properties[7] === 1); // 0=No, 1=Yes
		
		// object is sealed after this call, so make sure any properties you'll ever need are created, e.g.
		this.velocity = { x: 0, y: 0 };
		this.hasPositionTarget = false;
		this.targetX = 0;
		this.targetY = 0;

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
			"enabled": this.enabled,
			"tuid": this.type.targetUid,
			"max": this.maxSpeed,
			"min": this.minSpeed,
			"dec": this.deceleration,
			"rot": this.rotationSpeed,
			"rad": this.effectiveRadius,
			"vel": this.velocity,
			"hpt": this.hasPositionTarget,
			"tx": this.targetX,
			"ty": this.targetY,
			"iat": false, // No longer used, for savegame compatibility
			"sos": this.stopOnSolids
		};
	};
	
	// called when loading the full state of the game
	behinstProto.loadFromJSON = function (o)
	{
		// load from the state previously saved by saveToJSON
		// 'o' provides the same object that you saved, e.g.
		this.enabled = o["enabled"];
		this.type.targetUid = o["tuid"];
		this.maxSpeed = o["max"];
		this.minSpeed = o["min"];
		this.deceleration = o["dec"];
		this.rotationSpeed = o["rot"];
		this.effectiveRadius = o["rad"];
		this.velocity = o["vel"];
		this.hasPositionTarget = o["hpt"];
		this.targetX = o["tx"];
		this.targetY = o["ty"];
		this.stopOnSolids = o["sos"];
		// this.isAtTarget is no longer used
		// note you MUST use double-quote syntax (e.g. o["property"]) to prevent
		// Closure Compiler renaming and breaking the save format
	};

	behinstProto.tick = function ()
	{
		var dt = this.runtime.getDt(this.inst);
		var inst = this.inst;
		var vel = this.velocity;
		var targetObj = this.runtime.getObjectByUID(this.type.targetUid);
		var hasTarget = targetObj || this.hasPositionTarget;

		// If following an object, update the target coordinates.
		if (targetObj) {
			this.targetX = targetObj.x;
			this.targetY = targetObj.y;
		}
		
		// Do nothing if behavior is inactive.
		if (!this.enabled)
		{
			// Decelerate to a stop if inactive
			const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
            if (speed > 0) {
                const friction = this.deceleration * dt;
                const newSpeed = Math.max(0, speed - friction);
                const ratio = newSpeed / speed;
                vel.x *= ratio;
                vel.y *= ratio;
            }
		}
		else if (hasTarget) // Is enabled and has a target to move to
		{
            // --- Rotation ---
            const distance = cr.distanceTo(inst.x, inst.y, this.targetX, this.targetY);

            // If very close to the target, snap to position and stop.
            // This prevents jittering or orbiting the target point.
            // A threshold of 0.5 pixels is small enough to be unnoticeable.
            if (distance < 0.5)
            {
                vel.x = 0;
                vel.y = 0;
                inst.x = this.targetX;
                inst.y = this.targetY;
                inst.set_bbox_changed();
            }
			else {
				const targetAngle = cr.angleTo(inst.x, inst.y, this.targetX, this.targetY);
			
				// Only rotate the object if in 'Steering' mode.
				if (this.movementMode === 0) // 0 = Steering
				{
					inst.angle = cr.anglelerp(inst.angle, targetAngle, this.rotationSpeed * dt);
				}

				// Calculate speed based on distance.
				const speedRatio = Math.min(distance / this.effectiveRadius, 1.0);
				let targetSpeed = cr.lerp(this.minSpeed, this.maxSpeed, speedRatio);
				targetSpeed = Math.min(targetSpeed, distance / dt); // Prevent overshooting

				// Always calculate velocity based on the direct angle to the target
				// to ensure accurate movement and prevent orbiting.
				vel.x = Math.cos(targetAngle) * targetSpeed;
				vel.y = Math.sin(targetAngle) * targetSpeed;
			}
        }
		else // Is enabled but has no target
		{ /* No target, do nothing, allow deceleration from !enabled case if needed */ }

		// --- Limit Velocity (Safety check) ---
        const speedSq = vel.x * vel.x + vel.y * vel.y;
        const maxSpeedSq = this.maxSpeed * this.maxSpeed;
        if (speedSq > maxSpeedSq) {
            const ratio = this.maxSpeed / Math.sqrt(speedSq);
            vel.x *= ratio;
            vel.y *= ratio;
        }

		// --- Apply Final Velocity to Position ---
		if (vel.x !== 0 || vel.y !== 0)
		{
			if (this.stopOnSolids)
			{
				var oldx = inst.x;
				var oldy = inst.y;

				// Move X and check for collision
				inst.x += vel.x * dt;
				inst.set_bbox_changed();
				if (this.runtime.testOverlapSolid(inst)) {
					inst.x = oldx;
					vel.x = 0;
					inst.set_bbox_changed();
				}

				// Move Y and check for collision
				inst.y += vel.y * dt;
				inst.set_bbox_changed();
				if (this.runtime.testOverlapSolid(inst)) {
					inst.y = oldy;
					vel.y = 0;
					inst.set_bbox_changed();
				}
			}
			else
			{
				inst.x += vel.x * dt;
				inst.y += vel.y * dt;
				inst.set_bbox_changed();
			}
		}
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
				{"name": "Enabled", "value": this.enabled, "readonly": true},
				{"name": "Current Speed", "value": Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y).toFixed(2), "readonly": true},
				{"name": "Max speed", "value": this.maxSpeed},
				{"name": "Min speed", "value": this.minSpeed},
				{"name": "Deceleration", "value": this.deceleration},
				{"name": "Rotation speed", "value": this.rotationSpeed},
				{"name": "Effective radius", "value": this.effectiveRadius},
				{"name": "Stop on solids", "value": this.stopOnSolids},
				{"name": "Target", "value": targetName, "readonly": true}
			]
		});
	};
	
	behinstProto.onDebugValueEdited = function (header, name, value)
	{
		// Called when a non-readonly property has been edited in the debugger. Usually you only
		// will need 'name' (the property name) and 'value', but you can also use 'header' (the
		// header title for the section) to distinguish properties with the same name.
		switch (name) {
			case "Max speed": 		 this.maxSpeed = value; break;
			case "Min speed": 		 this.minSpeed = value; break;
			case "Deceleration": 	 this.deceleration = value; break;
			case "Rotation speed": 	 this.rotationSpeed = value; break;
			case "Effective radius": this.effectiveRadius = value; break;
			case "Stop on solids":	 this.stopOnSolids = value; break;
		}
	};
	/**END-PREVIEWONLY**/

	//////////////////////////////////////
	// Conditions
	function Cnds() {};
	
	Cnds.prototype.IsEnabled = function () { return this.enabled; };

	Cnds.prototype.IsMoving = function () { return this.velocity.x !== 0 || this.velocity.y !== 0; };

	behaviorProto.cnds = new Cnds();

	//////////////////////////////////////
	// Actions
	function Acts() {};

	Acts.prototype.SetEnabled = function (e)
	{
		this.enabled = (e === 1);
	};

	Acts.prototype.SetTarget = function (obj)
	{
		if (!obj) return;
		var inst = obj.getFirstPicked(this.inst);
		if (!inst) return;
		this.type.targetUid = inst.uid;
		this.hasPositionTarget = false; // An object target overrides a position target.
	};
	
	Acts.prototype.SetTargetPosition = function (x, y)
	{
		this.targetX = x;
		this.targetY = y;
		this.hasPositionTarget = true;
		this.type.targetUid = -1; // A position target overrides an object target
	};

	Acts.prototype.SetMaxSpeed = function (s) { this.maxSpeed = s; };
	Acts.prototype.SetMinSpeed = function (s) { this.minSpeed = s; };
	Acts.prototype.SetDeceleration = function (d) { this.deceleration = d; };
	Acts.prototype.SetRotationSpeed = function (r) { this.rotationSpeed = r; };
	Acts.prototype.SetEffectiveRadius = function (r) { this.effectiveRadius = r; };
	Acts.prototype.SetStopOnSolids = function (s) { this.stopOnSolids = (s === 1); };
	
	behaviorProto.acts = new Acts();

	//////////////////////////////////////
	// Expressions
	function Exps() {};
	
	Exps.prototype.CurrentSpeed = function (ret)
	{
		var speed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
		ret.set_float(speed);
	};
	
	behaviorProto.exps = new Exps();
	
}());
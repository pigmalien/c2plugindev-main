﻿// ECMAScript 5 strict mode
"use strict";

assert2(cr, "cr namespace not created");
assert2(cr.behaviors, "cr.behaviors not created");

/////////////////////////////////////
// Behavior class
// *** CHANGE THE BEHAVIOR ID HERE *** - must match the "id" property in edittime.js
//           vvvvvvvvvv
cr.behaviors.Shake = function(runtime)
{
	this.runtime = runtime;
};

(function ()
{
	// *** CHANGE THE BEHAVIOR ID HERE *** - must match the "id" property in edittime.js	
	var behaviorProto = cr.behaviors.Shake.prototype;
		
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
		this.active = false; // Not active on start by default
		this.magnitude = this.properties[0];
		this.duration = this.properties[1];
		this.mode = this.properties[2];      // 0=constant, 1=fade
		this.active = false;                 // Not active on start by default
		this.magnitude = 0;
		this.duration = 0;
		this.mode = 1;                       // 0=constant, 1=fade (default to fade)
		this.shakeOn = 0;                    // 0=position, 1=angle (default to position)
		
		// object is sealed after this call, so make sure any properties you'll ever need are created, e.g.
		this.initialDuration = this.duration;
		this.enabled = this.active;
		
		this.shakeX = 0;
		this.shakeY = 0;
		this.shakeAngle = 0;
		
		this.lastKnownX = this.inst.x;
		this.lastKnownY = this.inst.y;
		this.lastKnownAngle = this.inst.angle;
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
			"en": this.enabled,
			"mag": this.magnitude,
			"dur": this.duration,
			"idur": this.initialDuration,
			"m": this.mode,
			"so": this.shakeOn
		};
	};
	
	// called when loading the full state of the game
	behinstProto.loadFromJSON = function (o)
	{
		// load from the state previously saved by saveToJSON
		// 'o' provides the same object that you saved, e.g.
		this.enabled = o["en"];
		this.magnitude = o["mag"];
		this.duration = o["dur"];
		this.initialDuration = o["idur"];
		this.mode = o["m"];
		this.shakeOn = o["so"];
		// note you MUST use double-quote syntax (e.g. o["property"]) to prevent
		// Closure Compiler renaming and breaking the save format
	};

	behinstProto.tick = function ()
	{
		if (!this.enabled || this.duration <= 0)
		{
			// Reset to original position if we just stopped shaking
			if (this.shakeX !== 0 || this.shakeY !== 0 || this.shakeAngle !== 0)
			{
				if (this.shakeOn === 0) // Position
				{
					this.inst.x -= this.shakeX;
					this.inst.y -= this.shakeY;
				}
				else // Angle
				{
					this.inst.angle -= this.shakeAngle;
				}
				this.inst.set_bbox_changed();
				this.shakeX = 0;
				this.shakeY = 0;
				this.shakeAngle = 0;
			}
			return;
		}
		
		var dt = this.runtime.getDt(this.inst);
		this.duration -= dt;
		
		var currentMag = this.magnitude;
		if (this.mode === 1 && this.initialDuration > 0) // Fade out
			currentMag *= (this.duration / this.initialDuration);

		var newShakeX = (Math.random() - 0.5) * currentMag * 2;
		var newShakeY = (Math.random() - 0.5) * currentMag * 2;
		var newShakeAngle = cr.to_radians((Math.random() - 0.5) * currentMag * 2);

		if (this.shakeOn === 0) // Position
		{
			this.inst.x = this.inst.x - this.shakeX + newShakeX;
			this.inst.y = this.inst.y - this.shakeY + newShakeY;
			this.shakeX = newShakeX;
			this.shakeY = newShakeY;
		}
		else // Angle
		{
			this.inst.angle = this.inst.angle - this.shakeAngle + newShakeAngle;
			this.shakeAngle = newShakeAngle;
		}

		this.inst.set_bbox_changed();
		
		if (this.duration <= 0)
		{
			this.enabled = false;
		}
	};
	
	// The comments around these functions ensure they are removed when exporting, since the
	// debugger code is no longer relevant after publishing.
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
				// Each property entry can use the following values:
				// "name" (required): name of the property (must be unique within this section)
				// "value" (required): a boolean, number or string for the value
				// "html" (optional, default false): set to true to interpret the name and value
				//									 as HTML strings rather than simple plain text
				// "readonly" (optional, default false): set to true to disable editing the property
				{"name": "Is shaking", "value": this.enabled, "readonly": true},
				{"name": "Magnitude", "value": this.magnitude},
				{"name": "Duration", "value": this.duration, "readonly": true},
				{"name": "Progress", "value": this.initialDuration > 0 ? 1 - (this.duration / this.initialDuration) : 0, "readonly": true}
			]
		});
	};
	
	behinstProto.onDebugValueEdited = function (header, name, value)
	{
		// Called when a non-readonly property has been edited in the debugger. Usually you only
		// will need 'name' (the property name) and 'value', but you can also use 'header' (the
		// header title for the section) to distinguish properties with the same name.		
		if (name === "Magnitude")
			this.magnitude = value;
	};
	/**END-PREVIEWONLY**/

	//////////////////////////////////////
	// Conditions
	function Cnds() {};

	Cnds.prototype.IsShaking = function ()
	{
		return this.enabled && this.duration > 0;
	};
	
	// ... other conditions here ...
	
	behaviorProto.cnds = new Cnds();

	//////////////////////////////////////
	// Actions
	function Acts() {};
	
	Acts.prototype.Shake = function (mag, dur, mode, shakeOn)
	{
		this.magnitude = mag;
		this.duration = dur;
		this.initialDuration = dur;
		this.mode = mode;
		this.shakeOn = shakeOn;
		this.enabled = true;
	};
	
	Acts.prototype.Stop = function ()
	{
		this.enabled = false;
		this.duration = 0;
	};
	
	
	// ... other actions here ...
	
	behaviorProto.acts = new Acts();

	//////////////////////////////////////
	// Expressions
	function Exps() {};

	Exps.prototype.Magnitude = function (ret)
	{
		var currentMag = this.magnitude;
		if (this.mode === 1 && this.initialDuration > 0 && this.duration > 0) // Fade out
			currentMag *= (this.duration / this.initialDuration);
			
		ret.set_float(currentMag);
	};
	
	Exps.prototype.Duration = function (ret)
	{
		ret.set_float(this.duration < 0 ? 0 : this.duration);
	};
	
	Exps.prototype.Progress = function (ret)
	{
		ret.set_float(this.initialDuration > 0 ? 1 - (this.duration / this.initialDuration) : 0);
	};
	
	// ... other expressions here ...
	
	behaviorProto.exps = new Exps();
	
}());
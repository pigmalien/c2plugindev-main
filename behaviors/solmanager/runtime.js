// ECMAScript 5 strict mode
"use strict";

assert2(cr, "cr namespace not created");
assert2(cr.behaviors, "cr.behaviors not created");

/////////////////////////////////////
// Behavior class
cr.behaviors.SOLManager = function(runtime)
{
	this.runtime = runtime;
};

(function ()
{
	var behaviorProto = cr.behaviors.SOLManager.prototype;
		
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
		// No type-level setup needed
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
		// Map to store linked UIDs: { objectTypeIndex: linkedUID }
		this.linkedUIDs = {}; 
	};
	
	behinstProto.onDestroy = function ()
	{
		// No cleanup needed
	};
	
	// called when saving the full state of the game
	behinstProto.saveToJSON = function ()
	{
		return {
			"links": this.linkedUIDs
		};
	};
	
	// called when loading the full state of the game
	behinstProto.loadFromJSON = function (o)
	{
		this.linkedUIDs = o["links"];
	};

	behinstProto.tick = function ()
	{
		// No actions are required every tick
	};
	
	/**BEGIN-PREVIEWONLY**/
	// Debugger values (shows the stored links)
	behinstProto.getDebuggerValues = function (propsections)
	{
		var properties = [];
		var linkCount = 0;
		for (var typeIndex in this.linkedUIDs)
		{
			if (this.linkedUIDs.hasOwnProperty(typeIndex))
			{
				var objType = this.runtime.getObjectByIndex(parseInt(typeIndex, 10));
				if (objType)
				{
					properties.push({"name": objType.name, "value": this.linkedUIDs[typeIndex]});
					linkCount++;
				}
			}
		}

		if (linkCount === 0)
			properties.push({"name": "No links", "value": "Use 'Link by UID' action to set."});

		propsections.push({
			"title": this.type.name + " Links",
			"properties": properties
		});
	};
	
	behinstProto.onDebugValueEdited = function (header, name, value)
	{
		// Allow editing UID in debugger
		for (var typeIndex in this.linkedUIDs)
		{
			var objType = this.runtime.getObjectByIndex(parseInt(typeIndex, 10));
			if (objType && objType.name === name)
			{
				this.linkedUIDs[typeIndex] = parseInt(value, 10);
				return;
			}
		}
	};
	/**END-PREVIEWONLY**/

	//////////////////////////////////////
	// Conditions
	function Cnds() {};

	// Condition 0: Has linked instance of (checks if a link is stored)
	Cnds.prototype.HasLinkedInstance = function (objtype)
	{
		var typeIndex = objtype.index;
		var uid = this.linkedUIDs[typeIndex];
		
		// Check if a UID exists and is greater than 0
		return (typeof uid !== "undefined" && uid > 0);
	};

	// Condition 1: Pick linked instance (the core function)
	Cnds.prototype.PickLinkedInstance = function (objtype)
	{
		var typeIndex = objtype.index;
		var uid = this.linkedUIDs[typeIndex];

		// If no UID is linked, return false immediately
		if (typeof uid === "undefined" || uid <= 0)
			return false;

		// Attempt to get the actual instance from the runtime
		var targetInst = this.runtime.getObjectByUID(uid);
		
		if (!targetInst)
		{
			// Linked instance was destroyed; clear the link and return false
			delete this.linkedUIDs[typeIndex];
			return false;
		}

		// Ensure the found instance is of the correct object type
		if (targetInst.type !== objtype)
			return false;

		// Successfully picked the instance. Add it to the SOL.
		var sol = objtype.getCurrentSol();
		sol.select_all = false;
		sol.instances.length = 0;
		sol.instances[0] = targetInst;
		
		// The condition is true, and the instance is now in the SOL
		return true;
	};
	
	behaviorProto.cnds = new Cnds();

	//////////////////////////////////////
	// Actions
	function Acts() {};

	// Action 0: Link by UID
	Acts.prototype.LinkByUID = function (objtype, uid)
	{
		var typeIndex = objtype.index;
		var targetUID = Math.floor(uid); // Ensure UID is an integer

		// Perform a quick check to ensure the UID is valid and points to the right object type
		var targetInst = this.runtime.getObjectByUID(targetUID);
		
		if (targetInst && targetInst.type === objtype)
		{
			this.linkedUIDs[typeIndex] = targetUID;
		}
		else
		{
			// If the UID is invalid or links to the wrong object type, clear any existing link for this type.
			delete this.linkedUIDs[typeIndex];
		}
	};

	// Action 1: Clear link
	Acts.prototype.ClearLink = function (objtype)
	{
		var typeIndex = objtype.index;
		delete this.linkedUIDs[typeIndex];
	};
	
	behaviorProto.acts = new Acts();

	//////////////////////////////////////
	// Expressions
	function Exps() {};
	
	// Expression 0: LinkedUID
	Exps.prototype.LinkedUID = function (ret, objtype)
	{
		var typeIndex = objtype.index;
		var uid = this.linkedUIDs[typeIndex];
		
		if (typeof uid === "undefined")
			ret.set_int(0);
		else
			ret.set_int(uid);
	};
	
	behaviorProto.exps = new Exps();
	
}());
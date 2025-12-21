// ECMAScript 5 strict mode
"use strict";

assert2(cr, "cr namespace not created");
assert2(cr.behaviors, "cr.behaviors not created");

/////////////////////////////////////
// Behavior class
cr.behaviors.SnakeChain = function(runtime)
{
	this.runtime = runtime;
};

(function ()
{
	var behaviorProto = cr.behaviors.SnakeChain.prototype;
		
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
		this.inst = inst;				
		this.runtime = type.runtime;
		
		this.bodySegments = []; // Array to hold the actual JS object references
	};
	
	var behaviorInstProto = behaviorProto.Instance.prototype;

	behaviorInstProto.onCreate = function()
	{
		// Load properties
		this.segmentCount = this.properties[0];
		this.spacing = this.properties[1];
		this.smoothness = this.properties[2];
		this.mode = this.properties[3]; // 0=Distance, 1=History
		this.bodyTypeName = this.properties[4];
		
		// History buffer for the Head (used if Mode=History)
		this.history = []; 
		this.lastX = this.inst.x;
		this.lastY = this.inst.y;
	};

	behaviorInstProto.onDestroy = function ()
	{
		// Clean up segments when the head is destroyed
		this.DestroyChain();
	};

	behaviorInstProto.tick = function ()
	{
		// Update History (for History Mode)
		// Only record if moved
		var distMoved = cr.distanceTo(this.inst.x, this.inst.y, this.lastX || this.inst.x, this.lastY || this.inst.y);
		
		if (distMoved > 1) {
			this.history.unshift({x: this.inst.x, y: this.inst.y, angle: this.inst.angle});
			if (this.history.length > (this.segmentCount * (this.spacing + 10))) // Cap history size
				this.history.pop();
				
			this.lastX = this.inst.x;
			this.lastY = this.inst.y;
		}

		// Update Body Segments
		if (this.bodySegments.length === 0) return;

		var prevInst = this.inst; // Start with Head
		
		// Optimization: Keep track of history search position across segments
		var historyIndex = 0;
		var currentPathDist = 0;

		for (var i = 0; i < this.bodySegments.length; i++)
		{
			var currentInst = this.bodySegments[i];
			
			// Safety check: if segment destroyed externally
			var isDead = !currentInst || currentInst.dead || !currentInst.layer;
			
			// Double check with runtime lookup to ensure object really exists
			if (!isDead && this.runtime.getObjectByUID && !this.runtime.getObjectByUID(currentInst.uid))
				isDead = true;

			if (isDead)
			{
				this.bodySegments.splice(i, 1);
				i--;
				continue;
			}

			var targetX, targetY, targetAngle;

			if (this.mode === 0) // Distance Mode (Rigid follow)
			{
				var dx = prevInst.x - currentInst.x;
				var dy = prevInst.y - currentInst.y;
				var dist = Math.sqrt(dx*dx + dy*dy);

				if (dist > this.spacing)
				{
					var percent = this.spacing / dist;
					targetX = currentInst.x + dx * (1 - percent);
					targetY = currentInst.y + dy * (1 - percent);
				}
				else
				{
					targetX = currentInst.x;
					targetY = currentInst.y;
				}
				
				// Smooth Lerp to target
				currentInst.x = cr.lerp(currentInst.x, targetX, this.smoothness);
				currentInst.y = cr.lerp(currentInst.y, targetY, this.smoothness);
				
				// Point at predecessor
				currentInst.angle = cr.angleTo(currentInst.x, currentInst.y, prevInst.x, prevInst.y);
			}
			else if (this.mode === 1) // History Mode
			{
				var target_dist = (i + 1) * this.spacing;
				
				// Advance history pointer until we cover the required distance
				// Optimization: Resume from historyIndex instead of restarting at 0
				while (historyIndex < this.history.length - 1 && currentPathDist < target_dist)
				{
					currentPathDist += cr.distanceTo(this.history[historyIndex].x, this.history[historyIndex].y, this.history[historyIndex+1].x, this.history[historyIndex+1].y);
					historyIndex++;
				}

				if (currentPathDist >= target_dist)
				{
					var targetPoint = this.history[historyIndex];
					targetX = targetPoint.x;
					targetY = targetPoint.y;
					targetAngle = targetPoint.angle;
					
					// Use lerp for smooth movement towards the target point.
					currentInst.x = cr.lerp(currentInst.x, targetX, this.smoothness);
					currentInst.y = cr.lerp(currentInst.y, targetY, this.smoothness);
					
					// Use angleLerp for smooth angle changes
					currentInst.angle = cr.anglelerp(currentInst.angle, targetAngle, this.smoothness);
				}
				// If history is not long enough, segments wait.
			}

			currentInst.set_bbox_changed();
			prevInst = currentInst; // Set current as predecessor for next loop
		}
	};
	
	behaviorInstProto.DestroyChain = function()
	{
		for (var i = 0; i < this.bodySegments.length; i++)
		{
			if (this.bodySegments[i])
				this.runtime.DestroyInstance(this.bodySegments[i]);
		}
		this.bodySegments.length = 0;
	};

	// Helper to find object type by name
	behaviorInstProto.GetBodyType = function(name)
	{
		for (var i in this.runtime.types)
		{
			if (this.runtime.types[i].name === name)
				return this.runtime.types[i];
		}
		return null;
	};

	//////////////////////////////////////
	// Actions
	function Acts() {};

	Acts.prototype.BuildChain = function ()
	{
		// 1. Find the Object Type from the name string
		var bodyType = this.GetBodyType(this.bodyTypeName);

		if (!bodyType)
		{
			console.warn("SnakeChain: Body object type '" + this.bodyTypeName + "' not found.");
			return;
		}

		// 2. Clear existing
		this.DestroyChain();

		// 3. Spawn Loop
		var prevInst = this.inst; // Start at head
		
		for (var i = 0; i < this.segmentCount; i++)
		{
			// Create instance on same layer as head
			var newInst = this.runtime.createInstance(bodyType, this.inst.layer, prevInst.x, prevInst.y);
			
			if (newInst)
			{
				// Store direct reference
				this.bodySegments.push(newInst);
				
				// Optional: Set initial angle
				newInst.angle = prevInst.angle;
				newInst.set_bbox_changed();
				
				prevInst = newInst;
			}
		}
	};

	Acts.prototype.DestroyChain = function ()
	{
		this.DestroyChain();
	};

	Acts.prototype.ReorganiseChain = function ()
	{
		for (var i = 0; i < this.bodySegments.length; i++)
		{
			var inst = this.bodySegments[i];
			var isDead = !inst || inst.dead || !inst.layer;

			// Double check with runtime lookup to ensure object really exists
			if (!isDead && this.runtime.getObjectByUID && !this.runtime.getObjectByUID(inst.uid))
				isDead = true;

			if (isDead)
			{
				this.bodySegments.splice(i, 1);
				i--;
			}
		}
	};

	Acts.prototype.AddSegment = function ()
	{
		var bodyType = this.GetBodyType(this.bodyTypeName);

		if (!bodyType) return;

		var prevInst = this.inst;
		if (this.bodySegments.length > 0)
			prevInst = this.bodySegments[this.bodySegments.length - 1];
			
		var newInst = this.runtime.createInstance(bodyType, this.inst.layer, prevInst.x, prevInst.y);
		
		if (newInst)
		{
			this.bodySegments.push(newInst);
			newInst.angle = prevInst.angle;
			newInst.set_bbox_changed();
			
			this.segmentCount++;
		}
	};
	
	behaviorProto.acts = new Acts();

	//////////////////////////////////////
	// Expressions
	function Exps() {};
	
	Exps.prototype.SegmentCount = function (ret)
	{
		ret.set_int(this.bodySegments.length);
	};
	
	behaviorProto.exps = new Exps();
}());
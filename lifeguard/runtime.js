// ECMAScript 5 strict mode
"use strict";

assert2(cr, "cr namespace not created");
assert2(cr.plugins_, "cr.plugins_ not created");

/////////////////////////////////////
// Plugin class
cr.plugins_.Lifeguard = function(runtime)
{
	this.runtime = runtime;
};

(function ()
{
	var pluginProto = cr.plugins_.Lifeguard.prototype;
		
	/////////////////////////////////////
	// Object type class
	pluginProto.Type = function(plugin)
	{
		this.plugin = plugin;
		this.runtime = plugin.runtime;
	};

	var typeProto = pluginProto.Type.prototype;

	// Called on startup for each object type.
	typeProto.onCreate = function()
	{
        // This will hold the name of the last triggered global event.
        this.currentTriggerEvent = "";
        // This will temporarily hold the last spawned instance for the OnSpawned trigger.
        this.last_spawned_inst = null;
	};

	/////////////////////////////////////
	// Instance class
	pluginProto.Instance = function(type)
	{
		this.type = type;
		this.runtime = type.runtime;
	};
	
	var instanceProto = pluginProto.Instance.prototype;

	// Called whenever an instance is created.
	instanceProto.onCreate = function()
	{
		// Nothing to do here for a global singleton.
	};
	
	instanceProto.onDestroy = function ()
	{
        // Cleanup, if necessary.
	};
	
	instanceProto.saveToJSON = function ()
	{
		return {};
	};
	
	instanceProto.loadFromJSON = function (o)
	{
		// Nothing to load.
	};

	//////////////////////////////////////
	// Conditions
	function Cnds() {};

    // OnSpawned (trigger)
	Cnds.prototype.OnSpawned = function (objType)
	{
        var inst = this.type.last_spawned_inst;
		if (!inst)
			return false;
            
		if (objType !== inst.type)
			return false;
            
        // Pick the instance in the SOL
		objType.getCurrentSol().pick_one(inst);
		return true;
	};

    // OnGlobalEvent (trigger)
	Cnds.prototype.OnGlobalEvent = function (eventName)
	{
        // Compare the event name provided in the condition with the currently triggered event name.
		return cr.equals_nocase(eventName, this.type.currentTriggerEvent);
	};
	
	pluginProto.cnds = new Cnds();
	
	//////////////////////////////////////
	// Actions
	function Acts() {};

    // SetupPool action
	Acts.prototype.SetupPool = function (objType, initialCount)
	{
        if (!objType) return;

        // Use a property on the object type itself to store the pool.
        if (!objType.hasOwnProperty("gm_pool")) {
            objType.gm_pool = { 
                array: [], 
                currentActive: 0, 
                initialCount: initialCount 
            };
        }

        var pool = objType.gm_pool;
        var layer = this.runtime.getLayer(0); // Get the first layer as a default
        
        // Create the initial instances for the pool.
        for (var i = 0; i < initialCount; i++) {
            var inst = this.runtime.createInstance(objType, layer);
            if (inst) {
                inst.visible = false;
                pool.array.push(inst);
            } else {
                // Stop if we can't create more instances (e.g., instance limit reached).
                break;
            }
        }
	};
	
    // SpawnInstance action
	Acts.prototype.SpawnInstance = function (objType, x, y)
	{
        if (!objType) return;

        var pool = objType.gm_pool;
        if (!pool) {
            return;
        }

        var inst = null;
        // Find the first available (invisible) instance in the pool.
        for (var i = 0; i < pool.array.length; i++) {
            if (pool.array[i].visible === false) {
                inst = pool.array[i];
                break;
            }
        }

        if (inst) {
            // Found an instance to recycle.
            inst.x = x;
            inst.y = y;
            inst.visible = true;
            inst.set_bbox_changed();
            
            pool.currentActive++;
            
            // Store the instance and trigger "OnSpawned"
            this.type.last_spawned_inst = inst;
            this.runtime.trigger(cr.plugins_.Lifeguard.prototype.cnds.OnSpawned, this);
            this.type.last_spawned_inst = null; // Clear after triggering
        } else {
            // No inactive instances found.
        }
	};

    // TriggerGlobalEvent action
	Acts.prototype.TriggerGlobalEvent = function (eventName)
	{
        // Store the event name so the condition can check it.
        this.type.currentTriggerEvent = eventName;
        // Trigger the "OnGlobalEvent" condition on the plugin instance itself.
        this.runtime.trigger(cr.plugins_.Lifeguard.prototype.cnds.OnGlobalEvent, this);
	};
    
    // ReturnInstance action
	Acts.prototype.ReturnInstance = function (objType)
	{
		if (!objType) return;
        
        var sol = objType.getCurrentSol();
		var instances = sol.getObjects();
        if (instances.length === 0) return;
        
		var pool = objType.gm_pool;

		if (!pool)
		{
			return;
		}

        for (var i = 0; i < instances.length; i++)
        {
            var inst = instances[i];
            // Only recycle if it's currently active/visible
            if (inst.visible)
            {
                // Hide the instance and return it to the available pool
                inst.visible = false;
                // Move it off-screen (optional, but good practice)
                inst.x = -10000;
                inst.y = -10000;
                inst.set_bbox_changed();
                
                // Decrement the active count
                pool.currentActive = Math.max(0, pool.currentActive - 1);
            }
        }
	};

	// ReturnAllActive action
	Acts.prototype.ReturnAllActive = function (objType)
	{
        if (!objType) return;
		var pool = objType.gm_pool;

		if (!pool)
		{
			return;
		}

		// Iterate through the pool array and return any active instances
		var returnedCount = 0;
		for (var i = 0, len = pool.array.length; i < len; i++)
		{
			var inst = pool.array[i];
			if (inst && inst.visible)
			{
				inst.visible = false;
				inst.x = -10000;
				inst.y = -10000;
				inst.set_bbox_changed();
				returnedCount++;
			}
		}

		pool.currentActive = Math.max(0, pool.currentActive - returnedCount);
	};
	
	pluginProto.acts = new Acts();
	
	//////////////////////////////////////
	// Expressions
	function Exps() {};
	
	// PoolActiveCount expression
	Exps.prototype.PoolActiveCount = function (ret, objType)
	{
        if (!objType) {
            ret.set_int(0);
            return;
        }
		var pool = objType.gm_pool;
		
		if (!pool)
		{
			ret.set_int(0);
			return;
		}
		
		ret.set_int(pool.currentActive);
	};

	// PoolTotalCount expression
	Exps.prototype.PoolTotalCount = function (ret, objType)
	{
        if (!objType) {
            ret.set_int(0);
            return;
        }
		var pool = objType.gm_pool;
		
		if (!pool)
		{
			ret.set_int(0);
			return;
		}
		
		ret.set_int(pool.array.length);
	};
	
	pluginProto.exps = new Exps();

}());
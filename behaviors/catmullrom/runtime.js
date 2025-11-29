// Runtime
// Spline Path Mover Behavior
cr.behaviors.SplineMover = function(runtime)
{
	this.runtime = runtime;
};

(function ()
{
	var behaviorProto = cr.behaviors.SplineMover.prototype;

	/////////////////////////////////////
	// Behavior type class
	behaviorProto.Type = function(behavior, objtype)
	{
		this.behavior = behavior;
		this.objtype = objtype;
		this.runtime = behavior.runtime;
	};

	var typeProto = behaviorProto.Type.prototype;

	typeProto.onCreate = function()
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
	};
	
	var behaviorInstProto = behaviorProto.Instance.prototype;

	behaviorInstProto.onCreate = function()
	{
		this.tension = this.properties[0]; // Curve tension
		this.acceleration = this.properties[1];
		this.deceleration = this.properties[2];

		this.targetSpeed = 100; // The desired maximum speed
		this.currentSpeed = 0; // The actual speed this frame

        this.pointStack = []; // Array of {x: number, y: number} points
        
        this.isMoving = false;

		// These will be calculated when movement starts
		this.pathLength = 0;
		this.distanceTraveled = 0;
		this.arcLengthMap = []; // Lookup table for constant speed
		this.pathLength_bakeQuality = 200; // Segments to bake for length/speed calculation. Higher is more accurate.
	};	
	
    // --- Core Spline Calculation ---
    
    // Catmull-Rom Spline Interpolation function
    // p0, p1, p2, p3 are points. t is the normalized time (0.0 to 1.0) within the segment.
    behaviorInstProto.catmullRom = function(p0, p1, p2, p3, t, tension) {
        var t2 = t * t;
        var t3 = t * t * t;
        
        // Using the Cardinal spline formulation where Catmull-Rom is a special case.
        // The 's' parameter is derived from tension. s=0 is standard Catmull-Rom.
        var s = (1 - tension) / 2;
        
        var v1 = s * (p2 - p0);
        var v2 = s * (p3 - p1);
        
        var c1 =  2 * t3 - 3 * t2 + 1;
        var c2 = -2 * t3 + 3 * t2;
        var c3 =      t3 - 2 * t2 + t;
        var c4 =      t3 -     t2;

        return c1 * p1 + c2 * p2 + c3 * v1 + c4 * v2;
    };

    // Main position calculation based on overall normalized time (T_total)
    behaviorInstProto.getSplinePosition = function(T_total) {
        var len = this.pointStack.length;
        
        if (len < 2) {
            return {x: this.inst.x, y: this.inst.y};
        }
        
        if (len < 2) { // Should not happen if called from tick2, but good practice
            return {x: this.inst.x, y: this.inst.y};
        } else if (len < 3) { // Linear movement for 2 points
            var index = Math.floor(T_total * (len - 1));
            index = Math.max(0, Math.min(len - 2, index));
            var pStart = this.pointStack[index];
            var pEnd = this.pointStack[index + 1];
            
            // Time (t) within the segment
            var t_segment = (T_total * (len - 1)) - index;
            
            return {
                x: cr.lerp(pStart.x, pEnd.x, t_segment),
                y: cr.lerp(pStart.y, pEnd.y, t_segment)
            };
        }
        
        // --- Cubic Spline Logic (for len >= 4) ---
        
        // The number of curve segments is the number of points minus one.
        var numSegments = len - 1;
        
        // 1. Determine which segment we are currently on
        var segmentT = T_total * numSegments;
        var segmentIndex = Math.floor(segmentT);
        segmentIndex = Math.max(0, Math.min(numSegments - 1, segmentIndex)); 
        
        // 2. Determine the local time 't' (0.0 to 1.0) within that segment
        var t_local = segmentT - segmentIndex;
        
        // 3. Define the 4 points for Catmull-Rom. For endpoints, we "ghost" points
        // by duplicating the start/end points to ensure the curve starts and ends correctly.
        var p0Index = Math.max(0, segmentIndex - 1);
        var p1Index = segmentIndex;
        var p2Index = Math.min(len - 1, segmentIndex + 1);
        var p3Index = Math.min(len - 1, segmentIndex + 2);

        var p0 = this.pointStack[p0Index];
        var p1 = this.pointStack[p1Index];
        var p2 = this.pointStack[p2Index];
        var p3 = this.pointStack[p3Index];
        
        // Calculate the interpolated X and Y positions
        var x = this.catmullRom(p0.x, p1.x, p2.x, p3.x, t_local, this.tension);
        var y = this.catmullRom(p0.y, p1.y, p2.y, p3.y, t_local, this.tension);
        
        return {x: x, y: y};
    };

	// Creates a lookup table to map distance to normalized time 'T'
	behaviorInstProto.buildArcLengthMap = function()
	{
		if (this.pointStack.length < 2)
		{
			this.arcLengthMap = [];
			this.pathLength = 0;
			return;
		}

		var totalDist = 0;
		var lastPos = this.getSplinePosition(0);
		var curPos;

		this.arcLengthMap = [{t: 0, dist: 0}];

		var segments = this.pathLength_bakeQuality;
		for (var i = 1; i <= segments; i++)
		{
			var t = i / segments;
			curPos = this.getSplinePosition(t);
			totalDist += cr.distanceTo(lastPos.x, lastPos.y, curPos.x, curPos.y);
			lastPos = curPos;
			this.arcLengthMap.push({t: t, dist: totalDist});
		}
		this.pathLength = totalDist;
	};

	// Gets the normalized time 'T' for a given distance along the path
	behaviorInstProto.getTforDistance = function(dist)
	{
		if (dist <= 0) return 0;
		if (dist >= this.pathLength) return 1;

		// Find the two points in the map that bracket the distance
		for (var i = 1; i < this.arcLengthMap.length; i++) {
			if (this.arcLengthMap[i].dist >= dist) {
				var p1 = this.arcLengthMap[i-1];
				var p2 = this.arcLengthMap[i];
				// Interpolate between the two points to find the precise 't'
				return cr.lerp(p1.t, p2.t, (dist - p1.dist) / (p2.dist - p1.dist));
			}
		}
		return 1; // Should not be reached
	};

    // --- Time-based Movement ---

    // The tick function is called every frame. Even if empty, it must exist.
    behaviorInstProto.tick = function()
    {
        // All movement logic is in tick2 for this behavior.
    };

    behaviorInstProto.tick2 = function()
    {
        if (!this.isMoving) {
            return;
        }

        var dt = this.runtime.getDt();

		// --- Acceleration & Deceleration Logic ---
		var distanceToStop = 0;
		if (this.deceleration > 0) {
			distanceToStop = (this.currentSpeed * this.currentSpeed) / (2 * this.deceleration);
		}

		// If acceleration is 0, snap to target speed (unless we need to decelerate)
		if (this.acceleration === 0 && this.targetSpeed > 0) {
			this.currentSpeed = this.targetSpeed;
		}

		// If we are in the deceleration zone to stop at the end, or if speed is 0 (stopping)
		if ((this.pathLength - this.distanceTraveled) <= distanceToStop || this.targetSpeed === 0) {
			// Decelerate
			this.currentSpeed = Math.max(0, this.currentSpeed - this.deceleration * dt);
		}
		else if (this.currentSpeed < this.targetSpeed) {
			// Accelerate
			this.currentSpeed = Math.min(this.targetSpeed, this.currentSpeed + this.acceleration * dt);
		}

        this.distanceTraveled += this.currentSpeed * dt;

        if (this.distanceTraveled >= this.pathLength) {
            // Path finished: Snap to final point and stop
            this.distanceTraveled = this.pathLength;
            this.isMoving = false;
			this.currentSpeed = 0;
            
            var lastPoint = this.pointStack[this.pointStack.length - 1];
            this.inst.x = lastPoint.x;
            this.inst.y = lastPoint.y;
            
            this.runtime.trigger(cr.behaviors.SplineMover.prototype.cnds.OnPathFinished, this.inst);
        } else {
            // Find the normalized time 'T' that corresponds to the current distance
            var T = this.getTforDistance(this.distanceTraveled);
            // Get the position at that 'T'
            var newPos = this.getSplinePosition(T);

            this.inst.x = newPos.x;
            this.inst.y = newPos.y;
        }
        
        this.inst.set_bbox_changed();
    };

	
	// --- Actions ---
	
	function Acts() {};	
	// ACT 0: Push Point
	Acts.prototype.PushPoint = function (x, y)
	{
		this.pointStack.push({x: x, y: y});
        // If the path just reached the minimum for a spline segment (4 points), 
        // the movement needs to be able to start.
	};

	// ACT 1: Clear Stack
	Acts.prototype.ClearStack = function ()
	{
		this.pointStack = [];
        this.isMoving = false;
	};

    // ACT 2: Start Spline Movement
	Acts.prototype.StartMovement = function (speed)
	{
        if (this.pointStack.length < 2) {
            return; // Need at least 2 points for any movement
        }
        
		this.targetSpeed = speed;
		this.buildArcLengthMap();
        this.isMoving = true;
		this.distanceTraveled = 0;
		this.currentSpeed = 0; // Always start from 0 speed
        
        // Start movement from the calculated beginning of the spline, which might not be the first point
        // if there are enough points for a curve.
        var startPos = this.getSplinePosition(0);
        this.inst.x = startPos.x;
        this.inst.y = startPos.y;
	};
    
    // ACT 3: Stop Spline Movement
	Acts.prototype.StopMovement = function ()
	{
		// If deceleration is set, smoothly stop. Otherwise, stop instantly.
		if (this.deceleration > 0) {
			this.targetSpeed = 0;
		} else {
			this.isMoving = false;
			this.currentSpeed = 0;
		}
	};

	// ACT 4: Set Speed
	Acts.prototype.SetSpeed = function (speed)
	{
		this.targetSpeed = Math.max(0, speed);
	};

	// ACT 5: Set Tension
	Acts.prototype.SetTension = function (tension)
	{
		this.tension = tension;
	};

	// ACT 6 & 7: Set Acceleration/Deceleration
	Acts.prototype.SetAcceleration = function (accel) { this.acceleration = Math.max(0, accel); };
	Acts.prototype.SetDeceleration = function (decel) { this.deceleration = Math.max(0, decel);
	};

	behaviorProto.acts = new Acts();

	// --- Conditions ---

	function Cnds() {};

	// CND 0: On Path Finished
	Cnds.prototype.OnPathFinished = function ()
	{
		return true;
	};

	// CND 1: Is Moving
	Cnds.prototype.IsMoving = function ()
	{
		return this.isMoving;
	};
    
    // CND 2: Has enough points (needs 4 for a cubic segment)
	Cnds.prototype.HasEnoughPoints = function ()
	{
		return this.pointStack.length >= 4;
	};

	behaviorProto.cnds = new Cnds();

	// --- Expressions ---

	function Exps() {};


    // EXP 0: Current Path Time (0.0 to 1.0)
    Exps.prototype.CurrentTimeT = function (ret)
    {
        var T = (this.pathLength > 0) ? (this.distanceTraveled / this.pathLength) : 0;
        ret.set_float(Math.min(1.0, Math.max(0.0, T)));
    };

    // EXP 1: Total Points in Path
    Exps.prototype.TotalPoints = function (ret)
    {
        ret.set_int(this.pointStack.length);
    };

    // EXP 2: Angle of Motion
    Exps.prototype.AngleOfMotion = function (ret)
    {
        if (!this.isMoving || this.pathLength <= 0)
        {
            ret.set_float(cr.to_degrees(this.inst.angle));
            return;
        }

        // Get position slightly ahead of the current position
        var futureDistance = this.distanceTraveled + 1; // 1 pixel ahead
        var futureT = this.getTforDistance(futureDistance);
        var futurePos = this.getSplinePosition(futureT);

        // Calculate angle from current position to future position
        var angle = cr.angleTo(this.inst.x, this.inst.y, futurePos.x, futurePos.y);

        ret.set_float(cr.to_degrees(angle));
    };


	behaviorProto.exps = new Exps();

}());
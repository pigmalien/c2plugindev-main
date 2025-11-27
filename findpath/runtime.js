// ECMAScript 5 strict mode
"use strict";

assert2(cr, "cr namespace not created");
assert2(cr.behaviors, "cr.behaviors not created");

cr.behaviors.FieldSwarm = function(runtime)
{
	this.runtime = runtime;
};

(function ()
{
	var behaviorProto = cr.behaviors.FieldSwarm.prototype;
		
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
	};
	
	var behaviorInstProto = behaviorProto.Instance.prototype;

	behaviorInstProto.onCreate = function()
	{
		// Load properties (assuming edittime has been updated with these properties)
		// NOTE: Assuming 3 properties from previous edittime, adding new one at index 3
		this.cellWidth = this.properties[0];
		this.cellHeight = this.properties[1];
		this.moveSpeed = this.properties[2]; // Cells per second

		// State variables
		this.isMoving = false;
		this.path = []; // Array of {x: pixelX, y: pixelY}
		this.pathIndex = -1;
		this.targetX = 0; // Current cell target in pixels
		this.targetY = 0;

		// This will be populated by the 'AddWallObstacle' action
		this.wallObjectTypes = [];
	};

	behaviorInstProto.onDestroy = function ()
	{
	};
	
	////////////////////////////////////////////////////////////////
	// GRID COORDINATE HELPERS
	////////////////////////////////////////////////////////////////
	
	// Convert pixel coordinates to grid index
	behaviorInstProto.toGridX = function(x) {
		return Math.floor(x / this.cellWidth);
	};
	
	behaviorInstProto.toGridY = function(y) {
		return Math.floor(y / this.cellHeight);
	};
	
	// Convert grid index to center pixel coordinate
	behaviorInstProto.toPixelX = function(gridX) {
		return gridX * this.cellWidth + (this.cellWidth / 2);
	};

	behaviorInstProto.toPixelY = function(gridY) {
		return gridY * this.cellHeight + (this.cellHeight / 2);
	};
	
	////////////////////////////////////////////////////////////////
	// A* PATHFINDING ALGORITHM (Simplified Heuristic)
	////////////////////////////////////////////////////////////////

	behaviorInstProto.AStarPathfinding = function(startX, startY, endX, endY, wallMap)
	{
		// Node structure used in A*
		var Node = function(x, y, parent) {
			this.x = x;
			this.y = y;
			this.parent = parent;
			this.g = 0; // Cost from start
			this.h = 0; // Heuristic (estimated cost to end)
			this.f = 0; // g + h
			this.key = x + "," + y;
		};

		// Local isWall check using the provided map
		var isWall = function(gridX, gridY) {
			return !!wallMap[gridX + "," + gridY];
		};
		
		var gridStart = new Node(startX, startY, null);
		var gridEnd = new Node(endX, endY, null);
		
		var openList = [gridStart];
		var closedList = {};

		// Heuristic function (Manhattan distance)
		// Using Diagonal Distance heuristic, which is more appropriate for 8-directional movement.
		var heuristic = function(node, endNode) {			
			var D = 10; // Cost of straight movement
			var D2 = 14; // Cost of diagonal movement
			var dx = Math.abs(node.x - endNode.x);
			var dy = Math.abs(node.y - endNode.y);
			return D * (dx + dy) + (D2 - 2 * D) * Math.min(dx, dy); // Octile distance
		};
		
		gridStart.h = heuristic(gridStart, gridEnd);
		gridStart.f = gridStart.g + gridStart.h;

		var max_iterations = 15000; // Safeguard against extreme cases
		var iterations = 0;

		while (openList.length > 0 && iterations < max_iterations)
		{
			iterations++;

			// Find the node with the lowest F score in the open list
			var currentNode = openList[0];
			var currentIndex = 0;
			for(var i = 1; i < openList.length; i++) {
				if (openList[i].f < currentNode.f) {
					currentNode = openList[i];
					currentIndex = i;
				}
			}
			
			openList.splice(currentIndex, 1);
			closedList[currentNode.key] = true;
			
			// Goal Check
			if (currentNode.x === gridEnd.x && currentNode.y === gridEnd.y) {
				var path = [];
				var curr = currentNode;
				while (curr) {
					// We only push the pixel centers of the path cells
					path.push({x: this.toPixelX(curr.x), y: this.toPixelY(curr.y)});
					curr = curr.parent;
				}
				path.pop(); // Remove the current location's pixel coordinates
				return path.reverse();
			}

			// Generate Neighbors (8 directions)
			var neighbors = [];
			for(var dx = -1; dx <= 1; dx++) {
				for(var dy = -1; dy <= 1; dy++) {
					if (dx === 0 && dy === 0) continue;
					neighbors.push({x: currentNode.x + dx, y: currentNode.y + dy, isDiagonal: (dx !== 0 && dy !== 0)});
				}
			}

			// Process Neighbors
			for (var i = 0; i < neighbors.length; i++)
			{
				var neighbor = neighbors[i];
				var nKey = neighbor.x + "," + neighbor.y;

				if (isWall(neighbor.x, neighbor.y) || closedList[nKey]) {
					continue;
				}

				// --- FIX START: Prevent cutting corners ---
				// If moving diagonally, check if the adjacent cardinal cells are walls.
				if (neighbor.isDiagonal && (isWall(currentNode.x, neighbor.y) || isWall(neighbor.x, currentNode.y))) {
					continue;
				}
				// --- FIX END ---

				// Base cost is 1 for straight, ~1.4 for diagonal
				var base_cost = (neighbor.isDiagonal ? 14 : 10);
				var tentative_gScore = currentNode.g + base_cost;

				// Find neighbor in open list
				var neighborNode = null;
				for(var j = 0; j < openList.length; j++)
				{
					if(openList[j].key === nKey) {
						neighborNode = openList[j];
						break;
					}
				}

				if (neighborNode) { // Node is already in the open list
					if (tentative_gScore < neighborNode.g) { // A better path has been found
						// Update the node's scores and parent
						neighborNode.parent = currentNode;
						neighborNode.g = tentative_gScore;
						neighborNode.f = neighborNode.g + neighborNode.h; // h is already calculated
					}
				} else { // Node is not in the open list
					// New node found: calculate scores and add to open list
					neighborNode = new Node(neighbor.x, neighbor.y, currentNode);
					neighborNode.g = tentative_gScore;
					neighborNode.h = heuristic(neighborNode, gridEnd);
					neighborNode.f = neighborNode.g + neighborNode.h;
					openList.push(neighborNode); // Add to open list
				}
			}
		}

		return null; // Path not found
	};

	////////////////////////////////////////////////////////////////
	// MAIN TICK MOVEMENT LOGIC
	////////////////////////////////////////////////////////////////

	behaviorInstProto.tick = function ()
	{
		var dt = this.runtime.getDt(this.inst);

		if (!this.isMoving || !this.path || this.path.length === 0 || dt === 0) return;

		// Movement logic remains the same (smooth transition between cell centers)
		var target = this.path[this.pathIndex];
		
		var dx = target.x - this.inst.x;
		var dy = target.y - this.inst.y;
		var dist = Math.sqrt(dx*dx + dy*dy);
		
		var moveAmount = this.moveSpeed * this.cellWidth * dt;
		
		if (moveAmount >= dist)
		{
			this.inst.x = target.x;
			this.inst.y = target.y;
			
			this.pathIndex++;
			
			if (this.pathIndex >= this.path.length)
			{
				this.isMoving = false;
				this.runtime.trigger(cr.behaviors.FieldSwarm.prototype.cnds.OnMoveFinished, this.inst);
			}
			else
			{
				this.targetX = this.path[this.pathIndex].x;
				this.targetY = this.path[this.pathIndex].y;
			}
		}
		else
		{
			var normX = dx / dist;
			var normY = dy / dist;
			
			this.inst.x += normX * moveAmount;
			this.inst.y += normY * moveAmount;
			
			this.inst.angle = Math.atan2(normY, normX);
		}

		this.inst.set_bbox_changed();
	};

	//////////////////////////////////////
	// Conditions (Unchanged)
	function Cnds() {};
	
	Cnds.prototype.OnPathFound = function () { return true; };
	Cnds.prototype.OnPathFailed = function () { return true; };
	Cnds.prototype.OnMoveFinished = function () { return true; };
	Cnds.prototype.IsMoving = function () { return this.isMoving; };
	
	behaviorProto.cnds = new Cnds();

	//////////////////////////////////////
	// Actions
	function Acts() {};
	
	// Existing actions (SetGridSize, SetMoveSpeed, SetWall, ClearWall) remain here.
	
	Acts.prototype.SetGridSize = function (w, h)
	{
		this.cellWidth = w;
		this.cellHeight = h;
	};

	Acts.prototype.SetMoveSpeed = function (s)
	{
		this.moveSpeed = s;
	};

	Acts.prototype.FindPath = function (pixelX, pixelY)
	{
		var startGridX = this.toGridX(this.inst.x);
		var startGridY = this.toGridY(this.inst.y);
		var endGridX = this.toGridX(pixelX);
		var endGridY = this.toGridY(pixelY);
		
		// Bake wall objects into a temporary grid map for this pathfinding request
		var pathfindingGridMap = {};
		for (var i = 0; i < this.wallObjectTypes.length; i++) {
			var wallType = this.wallObjectTypes[i];
			var wallInstances = wallType.instances;
			for (var j = 0; j < wallInstances.length; j++) {
				var wallInst = wallInstances[j];
				var gridX = this.toGridX(wallInst.x);
				var gridY = this.toGridY(wallInst.y);
				pathfindingGridMap[gridX + "," + gridY] = true;
			}
		}

		if (startGridX === endGridX && startGridY === endGridY)
		{
			this.path = [];
			this.runtime.trigger(cr.behaviors.FieldSwarm.prototype.cnds.OnPathFound, this.inst);
			return;
		}

		this.path = this.AStarPathfinding(startGridX, startGridY, endGridX, endGridY, pathfindingGridMap);
		
		if (this.path && this.path.length > 0)
		{
			this.runtime.trigger(cr.behaviors.FieldSwarm.prototype.cnds.OnPathFound, this.inst);
		}
		else
		{
			this.path = null;
			this.runtime.trigger(cr.behaviors.FieldSwarm.prototype.cnds.OnPathFailed, this.inst);
		}
	};
	
	Acts.prototype.MoveAlongPath = function ()
	{
		if (!this.path || this.path.length === 0) return;
		
		this.isMoving = true;
		this.pathIndex = 0;
		this.targetX = this.path[0].x;
		this.targetY = this.path[0].y;
	};
	
	Acts.prototype.AddWallObstacle = function (objType)
	{
		if (!objType) return;
		// Avoid adding duplicates
		var i = this.wallObjectTypes.indexOf(objType);
		if (i === -1) {
			this.wallObjectTypes.push(objType);
		}
	};

	Acts.prototype.ClearWallObstacles = function ()
	{
		this.wallObjectTypes.length = 0;
	};

	behaviorProto.acts = new Acts();

	//////////////////////////////////////
	// Expressions (Unchanged)
	function Exps() {};
	
	Exps.prototype.TargetGridX = function (ret)
	{
		ret.set_int(this.toGridX(this.targetX));
	};

	Exps.prototype.TargetGridY = function (ret)
	{
		ret.set_int(this.toGridY(this.targetY));
	};
	
	behaviorProto.exps = new Exps();
}());
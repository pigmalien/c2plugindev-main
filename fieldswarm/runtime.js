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
		
		// A* Lists
		this.openList = [];
		this.closedList = {};
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
	
	// Check if a grid cell is marked as a wall
	behaviorInstProto.isWall = function(gridX, gridY) {
		return !!this.pathfindingGridMap[gridX + "," + gridY];
	};
	
	////////////////////////////////////////////////////////////////
	// A* PATHFINDING ALGORITHM (Simplified Heuristic)
	////////////////////////////////////////////////////////////////

	behaviorInstProto.AStarPathfinding = function(startX, startY, endX, endY)
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
		
		var gridStart = new Node(startX, startY, null);
		var gridEnd = new Node(endX, endY, null);
		
		this.openList = [gridStart];
		this.closedList = {};

		// Heuristic function (Manhattan distance)
		var heuristic = function(node, endNode) {
			return Math.abs(node.x - endNode.x) + Math.abs(node.y - endNode.y);
		};
		
		gridStart.h = heuristic(gridStart, gridEnd);
		gridStart.f = gridStart.g + gridStart.h;

		while (this.openList.length > 0)
		{
			// Find the node with the lowest F score in the open list
			var currentNode = this.openList[0];
			var currentIndex = 0;
			for(var i = 1; i < this.openList.length; i++) {
				if (this.openList[i].f < currentNode.f) {
					currentNode = this.openList[i];
					currentIndex = i;
				}
			}
			
			this.openList.splice(currentIndex, 1);
			this.closedList[currentNode.key] = true;
			
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

				if (this.isWall(neighbor.x, neighbor.y) || this.closedList[nKey]) {
					continue;
				}
				
				// --- FIX START: Prevent cutting corners ---
				// If moving diagonally, check if the adjacent cardinal cells are walls.
				if (neighbor.isDiagonal) {
					if (this.isWall(currentNode.x, neighbor.y) || this.isWall(neighbor.x, currentNode.y)) {
						continue;
					}
				}
				// --- FIX END ---
				
				// Base cost is 1 for straight, ~1.4 for diagonal
				var base_cost = (neighbor.isDiagonal ? 1.414 : 1);
				
				var tentative_gScore = currentNode.g + base_cost;
				
				var neighborNode = null;
				for(var j = 0; j < this.openList.length; j++) {
					if (this.openList[j].key === nKey) {
						neighborNode = this.openList[j];
						break;
					}
				}

				if (neighborNode === null) {
					// New node found: calculate scores and add to open list
					neighborNode = new Node(neighbor.x, neighbor.y, currentNode);
					neighborNode.g = tentative_gScore;
					neighborNode.h = heuristic(neighborNode, gridEnd);
					neighborNode.f = neighborNode.g + neighborNode.h;
					this.openList.push(neighborNode);
				} 
				else if (tentative_gScore < neighborNode.g) {
					// Found a better path to this node
					neighborNode.parent = currentNode;
					neighborNode.g = tentative_gScore;
					neighborNode.f = neighborNode.g + neighborNode.h;
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

		if (!this.isMoving || this.path.length === 0 || dt === 0) return;

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
		this.pathfindingGridMap = {};
		for (var i = 0; i < this.wallObjectTypes.length; i++) {
			var wallType = this.wallObjectTypes[i];
			var wallInstances = wallType.instances;
			for (var j = 0; j < wallInstances.length; j++) {
				var wallInst = wallInstances[j];
				var gridX = this.toGridX(wallInst.x);
				var gridY = this.toGridY(wallInst.y);
				this.pathfindingGridMap[gridX + "," + gridY] = true;
			}
		}

		if (startGridX === endGridX && startGridY === endGridY)
		{
			this.path = [];
			this.runtime.trigger(cr.behaviors.FieldSwarm.prototype.cnds.OnPathFound, this.inst);
			return;
		}

		this.path = this.AStarPathfinding(startGridX, startGridY, endGridX, endGridY);
		
		if (this.path && this.path.length > 0)
		{
			this.runtime.trigger(cr.behaviors.FieldSwarm.prototype.cnds.OnPathFound, this.inst);
		}
		else
		{
			this.path = [];
			this.runtime.trigger(cr.behaviors.FieldSwarm.prototype.cnds.OnPathFailed, this.inst);
		}
	};
	
	Acts.prototype.MoveAlongPath = function ()
	{
		if (this.path.length === 0) return;
		
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
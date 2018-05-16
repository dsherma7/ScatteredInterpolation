/* --------------------------------------------
    Class for computing the nearest neighbors
    as data is streamed into the class.
   ------------------------------------------- */
(function () {
	
	window.KNN = {};
	
	KNN.Item = function (object) {
		for (var key in object) {
			if (object.hasOwnProperty(key)) {
				this[key] = object[key];
			}
		}
	};

	KNN.Item.prototype.add = function(item) {
		this.x += item.x;
		this.y += item.y;
		this.z += item.z;
		this.f += item.f;
		return this;
	}
	
	KNN.Item.prototype.measureDistances = function(x_rng_obj, y_rng_obj, z_rng_obj, f_rng_obj) {
	
		var x_rng = x_rng_obj.max - x_rng_obj.min;
		var y_rng = y_rng_obj.max - y_rng_obj.min;
		var z_rng = z_rng_obj.max - z_rng_obj.min;
		var f_rng = f_rng_obj.max - f_rng_obj.min;

		for (var i in this.neighbors) {
			if (this.neighbors.hasOwnProperty(i)) {

				var neighbor = this.neighbors[i];

				var dx = neighbor.x - this.x;
				var dy = neighbor.y - this.y;
				var dz = neighbor.z - this.z;
				var df = neighbor.f - this.f;
				
				dx = dx / x_rng;
				dy = dy / y_rng;
				dz = dz / z_rng;
				df = df / f_rng;				

				neighbor.distance = Math.sqrt(dx*dx + dy*dy + dz*dz + df*df);
			}
		}
	};
	
	KNN.Item.prototype.sortByDistance = function() {
		var c = this;
		this.neighbors.sort(function (a, b) {
			return a.distance(c) - b.distance(c);
		});
	};
	
	KNN.Item.prototype.addNeighbor = function(node,k) {
		if (! this.neighbors) {this.neighbors = []};
		this.neighbors.push(node);
		if (this.neighbors.length > k) {
			this.sortByDistance();
			this.neighbors = this.neighbors.slice(0,k);
		}
	} 	

	KNN.Item.prototype.distance = function(node) {
		var dx = node.x - this.x;
		var dy = node.y - this.y;
		var dz = node.z - this.z;
		var df = node.f - this.f;

		return Math.sqrt( dx*dx + dy*dy + dz*dz + df*df );
	}



	KNN.ItemList = function (k) {
		this.nodes = [];
		this.k = k;
	};


	KNN.ItemList.prototype.updateNeighbors = function(node) {
		var k = this.k;		
		for (var i=0; i < this.nodes.length; i++){
			this.nodes[i].addNeighbor(node,k);
			node.addNeighbor(this.nodes[i],k);
		}
	}

	KNN.ItemList.prototype.add = function (node) {		
		this.updateNeighbors(node);
		this.nodes.push(node);
	};

	KNN.ItemList.prototype.getClosest = function (node) {		
		var min = 1000, best = this.nodes[0];
		this.nodes.forEach(function(d){
			var dist = (d.x - node.x)**2 + 0*(d.y - node.y)**2 + (d.z - node.z)**2 ;
			if (dist < min){
				min = dist;
				best = d;
			}
		});
		return best;		
	};	

	
})();

// Adapted from https://github.com/morecchia/k-nearest-neighbor-js
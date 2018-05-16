/* ------------------------ 
    Interpolation Method
   ------------------------ */
function interpolate(pts,point,scheme) {
    switch(scheme) {
        case "Shepard":
            return interpolateShepard(pts, point);
        case "Hardy":
            return interpolateHardy(pts, point);
        case "KNN":
            return interpolateMean(pts, point);
        default:
            console.error("Bad Interpolation Scheme Selected!")
    }
}

/* ------------------------ 
    Interpolation Schemes
   ------------------------ */

function interpolateMean(pts,point) {
	return mean4(pts); 
}

function interpolateShepard(pts,point) {
    var value_x = value_y = value_z = value_f = sum = 0;
    for (var i=0; i < pts.length; i++) {
        var d = d2(pts[i],point);
        if (d > 0){
            value_x += pts[i].x / d;
            value_y += pts[i].y / d;
            value_z += pts[i].z / d;
            value_f += pts[i].f / d;
            sum     +=  1/d;
        }
    }

    
    return {'x':value_x / sum, 'y':value_y / sum, 'z':value_z / sum, 'f':value_f / sum};
}

function interpolateHardy(pts,point,R) {
    R = R || 10;
    var A = f = c = [];
    for (var i=0; i < pts.length; i++) {
        var row = pts.map(j => Math.sqrt(R*R + d2(pts[i],j)));
        A.push(row);
    }    
  
    var c = {
        'x': math.usolve(A,pts.map(d => d.x)),
        'y': math.usolve(A,pts.map(d => d.y)),
        'z': math.usolve(A,pts.map(d => d.z)),
        'f': math.usolve(A,pts.map(d => d.f))    
    };
    
    var out = {'x':0,'y':0,'z':0,'f':0};
    pts.forEach(function(d,i){
        out.x += c.x[i] * Math.sqrt(R*R + d2(d,point));
        out.y += c.y[i] * Math.sqrt(R*R + d2(d,point));
        out.z += c.z[i] * Math.sqrt(R*R + d2(d,point));
        out.f += c.f[i] * Math.sqrt(R*R + d2(d,point));
    })

    return out;
}


/* ------------------------ 
    Helper Functions
   ------------------------ */

// Vector Datatypes to Match Open GL Notation
function vec3(x, y, z)    { return new THREE.Vector3(x, y, z);    }
function vec4(x, y, z, w) { return new THREE.Vector4(x, y, z, w); }

function mean4(vertices) {
    var x=0,y=0,z=0,f=0;
    var n = vertices.length;
    if (!n || n == 1)
        return {'x':vertices.x, 'y':vertices.y, 'z':vertices.z, 'f':vertices.f};
    vertices.map(function(d){ x += d.x / n; y += d.y / n; z += d.z / n; f += d.f});
    return {'x':x, 'y':y, 'z':z, 'f':f};
}

function d2(x,y) {
    return (x.x-y.x)*(x.x-y.x) + (x.y-y.y)*(x.y-y.y) + (x.z-y.z)*(x.z-y.z);
}
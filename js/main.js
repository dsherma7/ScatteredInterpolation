
// Build initial Canvas
var width = window.innerWidth, height = window.innerHeight;
var w = width / 3, h = height * 0.5;

// Global Variables for Animations
var paused = false, animating = false;
var last = new Date().getTime();
var down = false, sx = 0, sy = 0;
var palette, guiControlss=[], guis=[];

// Phong Lighting Variables
var sunDirection = [3.0, -2.0, 0.0],
    sunIntensity = [1.0, 1.0, 1.0],
    ambientLightIntensity = [0.3, 0.3, 0.3];

// Main Illustrations
var renderers = [], cameras=[], containers = [], shaderMaterials = [];
var scenes=[], pointGeos=[], pointGeo2s=[], scatterPlots=[], interpolatedPoints=[];

// Data Sources
var datasets = [], xExent, yExent, zExent;
var data_files = [ 'Sinusoidal','Wave', 'Gaussian', 'Hourglass' ];
var last_data = ['Sinusoidal', 'Sinusoidal'];
var k = 10; var knn_classes = [], last_neighbors = [k,k];

// Scales and Formatters
var format = d3.format("+.3f");
var colour = d3.scaleSequential(d3.interpolateRainbow),
    xScale = d3.scaleLinear().range([-50,50]),
    yScale = d3.scaleLinear().range([-50,50]),                  
    zScale = d3.scaleLinear().range([-50,50]),
    aScale = d3.scaleLinear().range([1, 0.5]),
    sScale = d3.scaleLinear().range([5, 0.2]);

function init() {
    // Load both sets of Shaders and starts the program
    loadTextResource('./gl/fragmentShader.glsl', function (fs_err, fs) {
        if (fs_err) {
            alert('Fatal error getting vertex shader (see console)');
            console.error(fs_err);
        } else {
            loadTextResource('./gl/vertexShader.glsl', function (vs_err, vs) {
                if (vs_err) {
                    alert('Fatal error getting fragment shader (see console)');
                    console.error(vs_err);
                } else {                     
                    build_transfer_function();                                         
                    init_render(0,vs,fs);    
                    init_render(1,vs,fs);    
                }
            });
        }
    });
};
loadData('Sinusoidal',0,function(){});
loadData('Sinusoidal',1,init);

function init_render(idx,vertexShader,fragmentShader) {

    guiControlss[idx] = new function() {
        this.model = 'Sinusoidal';
        this.scheme = 'Shepard';
        this.pts_added = 1000;
        this.neighbors = 4;
        this.sizes = 5.0;
        this.useLinear = true;
        this.transparent = true;
        this.phong = false;
        this.full = false;
    };    

    renderers[idx] = new THREE.WebGLRenderer();
    renderers[idx].setSize(w, h);
    renderers[idx].setClearColor(0x111111, 0.2);  // Changes BG colors

    cameras[idx] = new THREE.PerspectiveCamera(60, w / h, 0.01, 1000);
    cameras[idx].position.z = 200;

    containers[idx] = document.getElementById('container'+idx);
    containers[idx].appendChild(renderers[idx].domElement);
    var controls = new THREE.OrbitControls( cameras[idx], containers[idx] );
    controls.center.set( 0.0, 0.0, 0.0 );
    
    pointGeos[idx]          = new THREE.BufferGeometry();
    pointGeo2s[idx]         = new THREE.BufferGeometry();
    scatterPlots[idx]       = new THREE.Object3D();
    interpolatedPoints[idx] = new THREE.Object3D();    
    scenes[idx]             = new THREE.Scene();
    scenes[idx].add(scatterPlots[idx]);
    scenes[idx].add(interpolatedPoints[idx]);
    // scatterPlots[idx].rotation.y = 0;

    // Basic Shader Material for Everything
    shaderMaterials[idx] = new THREE.ShaderMaterial( {
        vertexShader:   vertexShader,
        fragmentShader: fragmentShader,
        transparent:    true,
        uniforms: { size :  
                        {type: "1f" , value: guiControlss[idx].sizes },
                    phong : 
                        {type: "i", value: 1},
                    ambientLightIntensity :  
                        {type: "fv", value: new Float32Array(3)},
                    sunDirection :  
                        {type: "fv", value: new Float32Array(3)},
                    sunIntensity :  
                        {type: "fv", value: new Float32Array(3)}}
    });

    /* --------------------------------
              Given points
       -------------------------------- */
    draw_plot(idx); 

    /* --------------------------------
            Add Lighting
       -------------------------------- */
    var light = new THREE.AmbientLight( 0x404040 ); // soft white light
    scenes[idx].add( light );

    var directionalLight = new THREE.DirectionalLight(0xff0000);
    directionalLight.position.set(10, 1, 1).normalize();
    scenes[idx].add(directionalLight);

    palette = d3.select("#interpolate_select");
    guis[idx] = new dat.GUI({autoplace: false});
    guis[idx].domElement.id = 'gui'+idx;

    animate();
    updateGUI();    
    onWindowResize();
    window.addEventListener( 'resize', onWindowResize, false );
}


function draw_plot(idx) {
    var pointCount = datasets[idx].length;    
    var vertices = [], colors = [], alphas = [], values = [];
    for (var i = 0; i < pointCount; i ++) {
        var x = xScale(datasets[idx][i].x);
        var y = yScale(datasets[idx][i].y);
        var z = zScale(datasets[idx][i].z);

        vertices = vertices.concat([x, y, z]);
        var rgb = d3.rgb(getColor(idx, datasets[idx][i].f));
        colors = colors.concat([rgb.r / 255,rgb.g / 255,rgb.b / 255]);
        alphas.push(getOpacity(idx, datasets[idx][i].f));
        values.push(datasets[idx][i].f);
    }
    pointGeos[idx].addAttribute('position', new THREE.BufferAttribute( new Float32Array(vertices), 3 ) );
    pointGeos[idx].addAttribute('color',    new THREE.BufferAttribute( new Float32Array(colors),   3 ) );    
    pointGeos[idx].addAttribute('alpha',    new THREE.BufferAttribute( new Float32Array(alphas),   1 ) );
    pointGeos[idx].addAttribute('value',    new THREE.BufferAttribute( new Float32Array(values),   1 ) );
    var points = new THREE.Points(pointGeos[idx], shaderMaterials[idx]);
    // interpolatedPoints[idx] = new THREE.Object3D();
    // interpolatedPoints[idx] = new THREE.Object3D();
    scatterPlots[idx].add(points);
    scenes[idx].add(scatterPlots[idx])

    // Add Interpolated Points    
    addInterpolatedPoints(idx);  
}


function addInterpolatedPoints(idx) {

    var sz = +guiControlss[idx].pts_added;

    if (guiControlss[idx].neighbors != last_neighbors[idx] || 
        guiControlss[idx].model     != last_data[idx]) {        
        delete pointGeo2s[idx].attributes.position;
        delete pointGeo2s[idx].attributes.color;
        delete pointGeo2s[idx].attributes.alpha;
        delete pointGeo2s[idx].attributes.value;

        last_neighbors[idx] = guiControlss[idx].neighbors;
        last_data[idx]      = guiControlss[idx].model;
    }


    if (guiControlss[idx].neighbors > knn_classes[idx].k){
        knn_classes[idx] = new KNN.ItemList(d3.max([2*knn_classes[idx].k, 2*guiControlss[idx].neighbors]));
        datasets[idx].forEach(d => knn_classes[idx].add( new KNN.Item(d) ));                
    }

    var vertices = [], colors = [], alphas = [], values = [];
    if (pointGeo2s[idx].attributes.alpha){
        sz = sz - pointGeo2s[idx].attributes.alpha.array.length;
        
        pointGeo2s[idx].attributes.position.array = pointGeo2s[idx].attributes.position.array.slice(0,3*sz);
        pointGeo2s[idx].attributes.color.array = pointGeo2s[idx].attributes.color.array.slice(0,3*sz);
        pointGeo2s[idx].attributes.alpha.array = pointGeo2s[idx].attributes.alpha.array.slice(0,sz);
        pointGeo2s[idx].attributes.value.array = pointGeo2s[idx].attributes.value.array.slice(0,sz);

        pointGeo2s[idx].attributes.position.count = pointGeo2s[idx].attributes.position.array.length;
        pointGeo2s[idx].attributes.color.count = pointGeo2s[idx].attributes.color.array.length;
        pointGeo2s[idx].attributes.alpha.count = pointGeo2s[idx].attributes.alpha.array.length;
        pointGeo2s[idx].attributes.value.count = pointGeo2s[idx].attributes.value.array.length;

        pointGeo2s[idx].attributes.position.array.forEach(d=>vertices.push(d));
        pointGeo2s[idx].attributes.color.array.forEach(d=>colors.push(d));
        pointGeo2s[idx].attributes.alpha.array.forEach(d=>alphas.push(d));
        pointGeo2s[idx].attributes.value.array.forEach(d=>values.push(d));        
    }
    
    for (var i=0; i < sz; i++){
    // for (var j=0; j < sz; j++){
        var x = xScale.domain()[0] + (xScale.domain()[1] - xScale.domain()[0]) / sz * Math.round(Math.random()*sz);
        var z = zScale.domain()[0] + (zScale.domain()[1] - zScale.domain()[0]) / sz * Math.round(Math.random()*sz);
        var y = yScale.domain()[0] + (yScale.domain()[1] - yScale.domain()[0]) / sz * Math.round(Math.random()*sz);

        var node = {'x':x,'y':y,'z':z};
        var best = knn_classes[idx].getClosest(node);
        var neighbors = best.neighbors.slice(0,guiControlss[idx].neighbors);
        var inter_pt = interpolate(neighbors, node, guiControlss[idx].scheme);

        var x = xScale(node.x);
        var y = yScale(inter_pt.y);
        var z = zScale(node.z);

        vertices = vertices.concat([x, y, z]);
        var rgb = d3.rgb(getColor(idx, best.f));
        colors = colors.concat([rgb.r / 255,rgb.g / 255,rgb.b / 255]);
        alphas.push(getOpacity(idx, inter_pt.f));
        values.push(inter_pt.f);          
    // }
    }

    pointGeo2s[idx].addAttribute('position', new THREE.BufferAttribute( new Float32Array(vertices), 3 ) );
    pointGeo2s[idx].addAttribute('color',    new THREE.BufferAttribute( new Float32Array(colors),   3 ) );    
    pointGeo2s[idx].addAttribute('alpha',    new THREE.BufferAttribute( new Float32Array(alphas),   1 ) );
    pointGeo2s[idx].addAttribute('value',    new THREE.BufferAttribute( new Float32Array(values),   1 ) );        
        
    pointGeo2s[idx].attributes.position.needsUpdate = true;
    pointGeo2s[idx].attributes.color.needsUpdate = true;
    pointGeo2s[idx].attributes.alpha.needsUpdate = true;
    pointGeo2s[idx].attributes.value.needsUpdate = true;

    var points = new THREE.Points(pointGeo2s[idx], shaderMaterials[idx]);
    // interpolatedPoints[idx] = new THREE.Object3D();
    interpolatedPoints[idx].add(points);
    scenes[idx].add(interpolatedPoints[idx])
}



function animate(t) {

    requestAnimationFrame( animate );
    render();
}

function render() {

    for (var idx=0; idx<guis.length; idx++){

        shaderMaterials[idx].transparent = guiControlss[idx].transparent;
        shaderMaterials[idx].uniforms.size.value = guiControlss[idx].sizes;
        shaderMaterials[idx].uniforms.phong.value = guiControlss[idx].phong;
        shaderMaterials[idx].uniforms.ambientLightIntensity.value = ambientLightIntensity;
        shaderMaterials[idx].uniforms.sunDirection.value = sunDirection;
        shaderMaterials[idx].uniforms.sunIntensity.value = sunIntensity;

        renderers[idx].render( scenes[idx], cameras[idx] );
    }
}


function loadData(file, idx, callback) {
    function type(d,i) { datasets[idx][i] = { x:+d.x, y:+d.y, z:+d.z, f:+d.f }}
    datasets[idx] = [];
    knn_classes[idx] = new KNN.ItemList(k);
    d3.csv("./data/"+file+".csv", type, function(d){

        if (!colorScales[idx])
             colorScales[idx] = d3.scaleLinear().range([tf_margin.left, tf_width-tf_margin.right]);
        colorScales[idx].domain(d3.extent(datasets[idx],d=>d.f));

        datasets[idx].forEach(d => knn_classes[idx].add( new KNN.Item(d) ));   
        
        xExent = d3.extent(datasets[idx], function (d) {return d.x; }),
        yExent = d3.extent(datasets[idx], function (d) {return d.y; }),
        zExent = d3.extent(datasets[idx], function (d) {return d.z; }),
        fExent = d3.extent(datasets[idx], function (d) {return d.f; }),

        colour.domain(fExent);
        xScale.domain(xExent);
        yScale.domain(yExent);
        zScale.domain(zExent);
        aScale.domain(fExent);

        callback();
    })
}

/* --------------------------  
      Controls for the Viz
   -------------------------- */
function updateGUI() 
{
    for (var idx=0; idx<guis.length; idx++){
        
        d3.select('div#gui'+idx).remove()
        guis[idx] = new dat.GUI({autoplace: false});
        guis[idx].domElement.id = 'gui'+idx;

        set_load_data = function(){
            var idx = +this.__gui.domElement.id.slice(-1); 
            var value = guiControlss[idx].model;
            if (guiControlss[idx].full)
                value = value+"_Full";
            loadData(value, idx, function(){draw_plot(idx)});
        }        
        update_points = function(){
            addInterpolatedPoints(this.domElement.classList.contains('0')?0:1)
        };

        guis[idx].add(guiControlss[idx], 'model', data_files )
                 .name("Dataset").onChange(set_load_data);
        guis[idx].add(guiControlss[idx], 'scheme', [ 'Hardy', 'Shepard', 'KNN' ])
                 .name("Interpolation").onFinishChange(update_points);    
        guis[idx].add(guiControlss[idx], 'neighbors', 2, 50)
                 .step(1).name("# Neighbors").onFinishChange(update_points);
        guis[idx].add(guiControlss[idx], 'pts_added', 10, 20000)
                 .step(25).name("Pts Added").onFinishChange(update_points);
        guis[idx].add(guiControlss[idx], 'sizes', 0.0, 50.0)
                 .name("Pt Size");
        guis[idx].add(guiControlss[idx], 'transparent')
                 .name('Transparent');
        guis[idx].add(guiControlss[idx], 'phong')
                 .name('Use Phong');
        guis[idx].add(guiControlss[idx], 'full')
                 .name('Full Plot').onChange(set_load_data);
        
        d3.select(guis[idx].domElement)
          .selectAll('div').classed(idx,true)
        d3.select(guis[idx].domElement)          
          .style('top', height/2+20 + 'px')
           .transition().delay(50)
           .style('width', width/4 + 'px')
  }
      
}


function onWindowResize( event ) {

    for (var idx=0; idx<guis.length; idx++){

        width = window.innerWidth;
        height = window.innerHeight;

        w = width / 3; 
        h = height * 0.5;

        cameras[idx].aspect = w / h;
        cameras[idx].updateProjectionMatrix();

        renderers[idx].setSize( w, h);

        guis[idx].width = width/4;
        guis[idx].height = height/2+50;
        
    }

    palette.style('top',height*3/4-30)
               .style('left',width/2-150)
    d3.select('.toolbar').style('width',width*1.1);
    reset_transfer_function();

}

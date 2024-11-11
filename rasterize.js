/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog4/triangles.json"; // triangles file loc
const INPUT_ELLIPSOIDS_URL = "https://ncsucgclass.github.io/prog4/ellipsoids.json"; // ellipsoids file loc


var defaultEye = vec3.fromValues(0.5, 0.5, -0.5); // default eye position in world space
var defaultCenter = vec3.fromValues(0.5, 0.5, 0.5); // default view direction in world space
var defaultUp = vec3.fromValues(0, 1, 0); // default view up vector
var lightAmbient = vec3.fromValues(1, 1, 1); // default light ambient emission
var lightDiffuse = vec3.fromValues(1, 1, 1); // default light diffuse emission
var lightSpecular = vec3.fromValues(1, 1, 1); // default light specular emission
var lightPosition = vec3.fromValues(-0.5, 1.5, -0.5); // default light position
var rotateTheta = Math.PI / 50; // how much to rotate models by with each key press

/* webgl and geometry data */
var gl = null; // the all powerful gl object. It's all here folks!
var inputTriangles = []; // the triangle data as loaded from input files
var numTriangleSets = 0; // how many triangle sets in input scene
var inputEllipsoids = []; // the ellipsoid data as loaded from input files
var numEllipsoids = 0; // how many ellipsoids in the input scene
var vertexBuffers = []; // this contains vertex coordinate lists by set, in triples
var normalBuffers = []; // this contains normal component lists by set, in triples
var uvBuffers = []; // this contains uv coordinate component lists by set, in doubles
var textures = []; // this contains the textures for each model
var triSetSizes = []; // this contains the size of each triangle set
var triangleBuffers = []; // lists of indices into vertexBuffers by set, in triples
var viewDelta = 0; // how much to displace view with each key press

/* shader parameter locations */
var vPosAttribLoc; // where to put position for vertex shader
var vNormAttribLoc; // where to put normals for vertex shader
var vUVAttribLoc; // where to put UV coordinates for vertex shader
var mMatrixULoc; // where to put model matrix for vertex shader
var pvmMatrixULoc; // where to put project model view matrix for vertex shader
var textureULoc; // where to put texture for fragment shader
var ambientULoc; // where to put ambient reflectivity for fragment shader
var diffuseULoc; // where to put diffuse reflectivity for fragment shader
var specularULoc; // where to put specular reflectivity for fragment shader
var shininessULoc; // where to put specular exponent for fragment shader
var alphaULoc;

const BLEND_MODES = 4; // number of total texture/lighting blending modes
var blendModeULoc; // where to put texture blending mode
var blendingMode = 0; // mode of blending between textures

var transparency = true;
var transparencyPassULoc;
var useTransparencyULoc;

var myScene = false;

/* interaction variables */
var Eye = vec3.clone(defaultEye); // eye position in world space
var Center = vec3.clone(defaultCenter); // view direction in world space
var Up = vec3.clone(defaultUp); // view up vector in world space

// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url, descr) {
    try {
        if ((typeof (url) !== "string") || (typeof (descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET", url, false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now() - startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open " + descr + " file!";
            else
                return JSON.parse(httpReq.response);
        } // end if good params
    } // end try    

    catch (e) {
        console.log(e);
        return (String.null);
    }
} // end get input json file

// does stuff when keys are pressed
function handleKeyDown(event) {

    const modelEnum = { TRIANGLES: "triangles", ELLIPSOID: "ellipsoid" }; // enumerated model type
    const dirEnum = { NEGATIVE: -1, POSITIVE: 1 }; // enumerated rotation direction

    function highlightModel(modelType, whichModel) {
        if (handleKeyDown.modelOn != null)
            handleKeyDown.modelOn.on = false;
        handleKeyDown.whichOn = whichModel;
        if (modelType == modelEnum.TRIANGLES)
            handleKeyDown.modelOn = inputTriangles[whichModel];
        else
            handleKeyDown.modelOn = inputEllipsoids[whichModel];
        handleKeyDown.modelOn.on = true;
    } // end highlight model

    function translateModel(offset) {
        if (handleKeyDown.modelOn != null)
            vec3.add(handleKeyDown.modelOn.translation, handleKeyDown.modelOn.translation, offset);
    } // end translate model

    function rotateModel(axis, direction) {
        if (handleKeyDown.modelOn != null) {
            var newRotation = mat4.create();

            mat4.fromRotation(newRotation, direction * rotateTheta, axis); // get a rotation matrix around passed axis
            vec3.transformMat4(handleKeyDown.modelOn.xAxis, handleKeyDown.modelOn.xAxis, newRotation); // rotate model x axis tip
            vec3.transformMat4(handleKeyDown.modelOn.yAxis, handleKeyDown.modelOn.yAxis, newRotation); // rotate model y axis tip
        } // end if there is a highlighted model
    } // end rotate model

    // set up needed view params
    var lookAt = vec3.create(), viewRight = vec3.create(), temp = vec3.create(); // lookat, right & temp vectors
    lookAt = vec3.normalize(lookAt, vec3.subtract(temp, Center, Eye)); // get lookat vector
    viewRight = vec3.normalize(viewRight, vec3.cross(temp, lookAt, Up)); // get view right vector

    // highlight static variables
    handleKeyDown.whichOn = handleKeyDown.whichOn == undefined ? -1 : handleKeyDown.whichOn; // nothing selected initially
    handleKeyDown.modelOn = handleKeyDown.modelOn == undefined ? null : handleKeyDown.modelOn; // nothing selected initially

    switch (event.code) {

        // model selection
        case "Space":
            if (handleKeyDown.modelOn != null)
                handleKeyDown.modelOn.on = false; // turn off highlighted model
            handleKeyDown.modelOn = null; // no highlighted model
            handleKeyDown.whichOn = -1; // nothing highlighted
            break;
        case "ArrowRight": // select next triangle set
            highlightModel(modelEnum.TRIANGLES, (handleKeyDown.whichOn + 1) % numTriangleSets);
            break;
        case "ArrowLeft": // select previous triangle set
            highlightModel(modelEnum.TRIANGLES, (handleKeyDown.whichOn > 0) ? handleKeyDown.whichOn - 1 : numTriangleSets - 1);
            break;
        case "ArrowUp": // select next ellipsoid
            highlightModel(modelEnum.ELLIPSOID, (handleKeyDown.whichOn + 1) % numEllipsoids);
            break;
        case "ArrowDown": // select previous ellipsoid
            highlightModel(modelEnum.ELLIPSOID, (handleKeyDown.whichOn > 0) ? handleKeyDown.whichOn - 1 : numEllipsoids - 1);
            break;

        // view change
        case "KeyA": // translate view left, rotate left with shift
            Center = vec3.add(Center, Center, vec3.scale(temp, viewRight, viewDelta));
            if (!event.getModifierState("Shift"))
                Eye = vec3.add(Eye, Eye, vec3.scale(temp, viewRight, viewDelta));
            break;
        case "KeyD": // translate view right, rotate right with shift
            Center = vec3.add(Center, Center, vec3.scale(temp, viewRight, -viewDelta));
            if (!event.getModifierState("Shift"))
                Eye = vec3.add(Eye, Eye, vec3.scale(temp, viewRight, -viewDelta));
            break;
        case "KeyS": // translate view backward, rotate up with shift
            if (event.getModifierState("Shift")) {
                Center = vec3.add(Center, Center, vec3.scale(temp, Up, viewDelta));
                Up = vec3.cross(Up, viewRight, vec3.subtract(lookAt, Center, Eye)); /* global side effect */
            } else {
                Eye = vec3.add(Eye, Eye, vec3.scale(temp, lookAt, -viewDelta));
                Center = vec3.add(Center, Center, vec3.scale(temp, lookAt, -viewDelta));
            } // end if shift not pressed
            break;
        case "KeyW": // translate view forward, rotate down with shift
            if (event.getModifierState("Shift")) {
                Center = vec3.add(Center, Center, vec3.scale(temp, Up, -viewDelta));
                Up = vec3.cross(Up, viewRight, vec3.subtract(lookAt, Center, Eye)); /* global side effect */
            } else {
                Eye = vec3.add(Eye, Eye, vec3.scale(temp, lookAt, viewDelta));
                Center = vec3.add(Center, Center, vec3.scale(temp, lookAt, viewDelta));
            } // end if shift not pressed
            break;
        case "KeyQ": // translate view up, rotate counterclockwise with shift
            if (event.getModifierState("Shift"))
                Up = vec3.normalize(Up, vec3.add(Up, Up, vec3.scale(temp, viewRight, -viewDelta)));
            else {
                Eye = vec3.add(Eye, Eye, vec3.scale(temp, Up, viewDelta));
                Center = vec3.add(Center, Center, vec3.scale(temp, Up, viewDelta));
            } // end if shift not pressed
            break;
        case "KeyE": // translate view down, rotate clockwise with shift
            if (event.getModifierState("Shift"))
                Up = vec3.normalize(Up, vec3.add(Up, Up, vec3.scale(temp, viewRight, viewDelta)));
            else {
                Eye = vec3.add(Eye, Eye, vec3.scale(temp, Up, -viewDelta));
                Center = vec3.add(Center, Center, vec3.scale(temp, Up, -viewDelta));
            } // end if shift not pressed
            break;
        case "Escape": // reset view to default
            Eye = vec3.copy(Eye, defaultEye);
            Center = vec3.copy(Center, defaultCenter);
            Up = vec3.copy(Up, defaultUp);
            break;

        // model transformation
        case "KeyK": // translate left, rotate left with shift
            if (event.getModifierState("Shift"))
                rotateModel(Up, dirEnum.NEGATIVE);
            else
                translateModel(vec3.scale(temp, viewRight, viewDelta));
            break;
        case "Semicolon": // translate right, rotate right with shift
            if (event.getModifierState("Shift"))
                rotateModel(Up, dirEnum.POSITIVE);
            else
                translateModel(vec3.scale(temp, viewRight, -viewDelta));
            break;
        case "KeyL": // translate backward, rotate up with shift
            if (event.getModifierState("Shift"))
                rotateModel(viewRight, dirEnum.POSITIVE);
            else
                translateModel(vec3.scale(temp, lookAt, -viewDelta));
            break;
        case "KeyO": // translate forward, rotate down with shift
            if (event.getModifierState("Shift"))
                rotateModel(viewRight, dirEnum.NEGATIVE);
            else
                translateModel(vec3.scale(temp, lookAt, viewDelta));
            break;
        case "KeyI": // translate up, rotate counterclockwise with shift 
            if (event.getModifierState("Shift"))
                rotateModel(lookAt, dirEnum.POSITIVE);
            else
                translateModel(vec3.scale(temp, Up, viewDelta));
            break;
        case "KeyP": // translate down, rotate clockwise with shift
            if (event.getModifierState("Shift"))
                rotateModel(lookAt, dirEnum.NEGATIVE);
            else
                translateModel(vec3.scale(temp, Up, -viewDelta));
            break;
        case "Backspace": // reset model transforms to default
            for (var whichTriSet = 0; whichTriSet < numTriangleSets; whichTriSet++) {
                vec3.set(inputTriangles[whichTriSet].translation, 0, 0, 0);
                vec3.set(inputTriangles[whichTriSet].xAxis, 1, 0, 0);
                vec3.set(inputTriangles[whichTriSet].yAxis, 0, 1, 0);
            } // end for all triangle sets
            for (var whichEllipsoid = 0; whichEllipsoid < numEllipsoids; whichEllipsoid++) {
                vec3.set(inputEllipsoids[whichEllipsoid].translation, 0, 0, 0);
                vec3.set(inputEllipsoids[whichTriSet].xAxis, 1, 0, 0);
                vec3.set(inputEllipsoids[whichTriSet].yAxis, 0, 1, 0);
            } // end for all ellipsoids
            break;
        case "KeyB":
            blendingMode = (blendingMode + 1) % BLEND_MODES;
            var s = "";
            switch (blendingMode) {
                case 0: s = "Combine"; break;
                case 1: s = "Texture color only"; break;
                case 2: s = "Lighting color only"; break;
                case 3: s = "Depth buffer value"; break;
            }
            console.log("Blending mode: " + blendingMode + " [" + s + "]");
            break;
        case "KeyV":
            transparency = !transparency;
            console.log("Transparency: " + (transparency ? "on" : "off"));
            break;
        case "Digit1":
            if (!event.getModifierState("Shift")) {
                break;
            }
            myScene = !myScene;
            loadModels();
            break;
    } // end switch
} // end handleKeyDown

// set up the webGL environment
function setupWebGL() {

    // Set up keys
    document.onkeydown = handleKeyDown; // call this when key pressed


    var imageCanvas = document.getElementById("myImageCanvas"); // create a 2d canvas
    var cw = imageCanvas.width, ch = imageCanvas.height;
    imageContext = imageCanvas.getContext("2d");
    var bkgdImage = new Image();
    bkgdImage.crossOrigin = "Anonymous";
    bkgdImage.src = "https://ncsucgclass.github.io/prog3/sky.jpg";
    bkgdImage.onload = function () {
        var iw = bkgdImage.width, ih = bkgdImage.height;
        imageContext.drawImage(bkgdImage, 0, 0, iw, ih, 0, 0, cw, ch);
    }


    // Get the canvas and context
    var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it

    try {
        if (gl == null) {
            throw "unable to create gl context -- is your browser gl ready?";
        } else {
            //gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
            gl.clearDepth(1.0); // use max when we clear the depth buffer
            gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
        }
    } // end try

    catch (e) {
        console.log(e);
    } // end catch

} // end setupWebGL


// load a texture from a given URL
// adapted from webglfundamentals.org reference on loading image textures from cross-origin images
function loadTexture(url) {
    var data = {
        width: 1,
        height: 1,
        texture: null
    };

    // create and bind texture data
    data.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, data.texture);

    // start with single pixel of pink error color
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 0, 255, 255]));

    // handle for non-power-of-2 size
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // setup asynchronous image loading
    var image = new Image();
    image.addEventListener('load', function () {
        data.width = image.width;
        data.height = image.height;

        gl.bindTexture(gl.TEXTURE_2D, data.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    })

    // handle cross-origin images
    if ((new URL(url, window.location.href)).origin !== window.location.origin) {
        image.crossOrigin = "";
    }

    image.src = url;
    return data
}

function loadTriangles(maxCorner, minCorner) {
    inputTriangles = getJSONFile(INPUT_TRIANGLES_URL, "triangles"); // read in the triangle data
    if (myScene) {
        inputTriangles = createMyTriangles();
    }

    if (inputTriangles == String.null)
        throw "Unable to load triangles file!";
    else {
        var whichSetVert; // index of vertex in current triangle set
        var whichSetTri; // index of triangle in current triangle set
        var vtxToAdd; // vtx coords to add to the coord array
        var normToAdd; // vtx normal to add to the coord array
        var uvToAdd;
        var triToAdd; // tri indices to add to the index array

        // process each triangle set to load webgl vertex and triangle buffers
        numTriangleSets = inputTriangles.length; // remember how many tri sets
        for (var whichSet = 0; whichSet < numTriangleSets; whichSet++) { // for each tri set

            // set up highlighting, modeling translation and rotation
            inputTriangles[whichSet].center = vec3.fromValues(0, 0, 0);  // center point of tri set
            inputTriangles[whichSet].on = false; // not highlighted
            inputTriangles[whichSet].translation = vec3.fromValues(0, 0, 0); // no translation
            inputTriangles[whichSet].xAxis = vec3.fromValues(1, 0, 0); // model X axis
            inputTriangles[whichSet].yAxis = vec3.fromValues(0, 1, 0); // model Y axis 

            // set up the vertex and normal arrays, define model center and axes
            inputTriangles[whichSet].glVertices = []; // flat coord list for webgl
            inputTriangles[whichSet].glNormals = []; // flat normal list for webgl
            inputTriangles[whichSet].glUVs = []; // flat uv list for webgl

            var numVerts = inputTriangles[whichSet].vertices.length; // num vertices in tri set

            for (whichSetVert = 0; whichSetVert < numVerts; whichSetVert++) { // verts in set
                vtxToAdd = inputTriangles[whichSet].vertices[whichSetVert]; // get vertex to add
                normToAdd = inputTriangles[whichSet].normals[whichSetVert]; // get normal to add
                uvToAdd = inputTriangles[whichSet].uvs[whichSetVert]; // get uv to add
                inputTriangles[whichSet].glVertices.push(vtxToAdd[0], vtxToAdd[1], vtxToAdd[2]); // put coords in set coord list
                inputTriangles[whichSet].glNormals.push(normToAdd[0], normToAdd[1], normToAdd[2]); // put normal in set coord list
                inputTriangles[whichSet].glUVs.push(uvToAdd[0], 1 - uvToAdd[1]); // put uv in set coord list
                vec3.max(maxCorner, maxCorner, vtxToAdd); // update world bounding box corner maxima
                vec3.min(minCorner, minCorner, vtxToAdd); // update world bounding box corner minima
                vec3.add(inputTriangles[whichSet].center, inputTriangles[whichSet].center, vtxToAdd); // add to ctr sum
            } // end for vertices in set

            vec3.scale(inputTriangles[whichSet].center, inputTriangles[whichSet].center, 1 / numVerts); // avg ctr sum

            // for debug purposes
            var c = inputTriangles[whichSet].center;
            console.log(
                "Center of this triangle set: " +
                c[0] + ", " +
                c[1] + ", " +
                c[2]
            );

            // send the vertex coords and normals to webGL
            vertexBuffers[whichSet] = gl.createBuffer(); // init empty webgl set vertex coord buffer
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[whichSet]); // activate that buffer
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(inputTriangles[whichSet].glVertices), gl.STATIC_DRAW); // data in
            normalBuffers[whichSet] = gl.createBuffer(); // init empty webgl set normal component buffer
            gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[whichSet]); // activate that buffer
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(inputTriangles[whichSet].glNormals), gl.STATIC_DRAW); // data in
            uvBuffers[whichSet] = gl.createBuffer(); // init empty webgl set uv coord buffer
            gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffers[whichSet]);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(inputTriangles[whichSet].glUVs), gl.STATIC_DRAW); // data in

            // load the texture for each triangle set
            textures[whichSet] = loadTexture(inputTriangles[whichSet].material.texture).texture;

            // set up the triangle index array, adjusting indices across sets
            inputTriangles[whichSet].glTriangles = []; // flat index list for webgl
            triSetSizes[whichSet] = inputTriangles[whichSet].triangles.length; // number of tris in this set
            for (whichSetTri = 0; whichSetTri < triSetSizes[whichSet]; whichSetTri++) {
                triToAdd = inputTriangles[whichSet].triangles[whichSetTri]; // get tri to add
                inputTriangles[whichSet].glTriangles.push(triToAdd[0], triToAdd[1], triToAdd[2]); // put indices in set list
            } // end for triangles in set

            // send the triangle indices to webGL
            triangleBuffers.push(gl.createBuffer()); // init empty triangle index buffer
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichSet]); // activate that buffer
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(inputTriangles[whichSet].glTriangles), gl.STATIC_DRAW); // data in

        } // end for each triangle set 
    }
}

// make an ellipsoid, with numLongSteps longitudes.
// start with a sphere of radius 1 at origin
// Returns verts, tris and normals.
function makeEllipsoid(currEllipsoid, numLongSteps, minXYZ, maxXYZ, minCorner, maxCorner) {

    try {
        if (numLongSteps % 2 != 0)
            throw "in makeSphere: uneven number of longitude steps!";
        else if (numLongSteps < 4)
            throw "in makeSphere: number of longitude steps too small!";
        else { // good number longitude steps

            console.log("ellipsoid xyz: " + currEllipsoid.x + " " + currEllipsoid.y + " " + currEllipsoid.z);

            // make vertices
            var ellipsoidVertices = [0, -1, 0]; // vertices to return, init to south pole
            var ellipsoidUVs = [0.5, 0];

            var angleIncr = (2 * Math.PI) / numLongSteps; // angular increment 
            var latLimitAngle = angleIncr * (Math.floor(numLongSteps / 4) - 1); // start/end lat angle
            var latRadius, latY; // radius and Y at current latitude
            for (var latAngle = -latLimitAngle; latAngle <= latLimitAngle; latAngle += angleIncr) {
                latRadius = Math.cos(latAngle); // radius of current latitude
                latY = Math.sin(latAngle); // height at current latitude
                for (var longAngle = 0; longAngle < 2 * Math.PI; longAngle += angleIncr) { // for each long
                    ellipsoidVertices.push(latRadius * Math.sin(longAngle), latY, latRadius * Math.cos(longAngle));
                    ellipsoidUVs.push(longAngle / (2.0 * Math.PI), 1.0 - (latAngle / (Math.PI) + 0.5));
                }

            } // end for each latitude
            ellipsoidVertices.push(0, 1, 0); // add north pole
            ellipsoidUVs.push(0.5, 1);
            ellipsoidVertices = ellipsoidVertices.map(function (val, idx) { // position and scale ellipsoid
                switch (idx % 3) {
                    case 0: // x
                        return (val * currEllipsoid.a + currEllipsoid.x);
                    case 1: // y
                        return (val * currEllipsoid.b + currEllipsoid.y);
                    case 2: // z
                        return (val * currEllipsoid.c + currEllipsoid.z);
                } // end switch
            });

            // make normals using the ellipsoid gradient equation
            // resulting normals are unnormalized: we rely on shaders to normalize
            var ellipsoidNormals = ellipsoidVertices.slice(); // start with a copy of the transformed verts
            ellipsoidNormals = ellipsoidNormals.map(function (val, idx) { // calculate each normal
                switch (idx % 3) {
                    case 0: // x
                        return (2 / (currEllipsoid.a * currEllipsoid.a) * (val - currEllipsoid.x));
                    case 1: // y
                        return (2 / (currEllipsoid.b * currEllipsoid.b) * (val - currEllipsoid.y));
                    case 2: // z
                        return (2 / (currEllipsoid.c * currEllipsoid.c) * (val - currEllipsoid.z));
                } // end switch
            });

            // make triangles, from south pole to middle latitudes to north pole
            var ellipsoidTriangles = []; // triangles to return
            for (var whichLong = 1; whichLong < numLongSteps; whichLong++) // south pole
                ellipsoidTriangles.push(0, whichLong, whichLong + 1);
            ellipsoidTriangles.push(0, numLongSteps, 1); // longitude wrap tri
            var llVertex; // lower left vertex in the current quad
            for (var whichLat = 0; whichLat < (numLongSteps / 2 - 2); whichLat++) { // middle lats
                for (var whichLong = 0; whichLong < numLongSteps - 1; whichLong++) {
                    llVertex = whichLat * numLongSteps + whichLong + 1;
                    ellipsoidTriangles.push(llVertex, llVertex + numLongSteps, llVertex + numLongSteps + 1);
                    ellipsoidTriangles.push(llVertex, llVertex + numLongSteps + 1, llVertex + 1);
                } // end for each longitude
                ellipsoidTriangles.push(llVertex + 1, llVertex + numLongSteps + 1, llVertex + 2);
                ellipsoidTriangles.push(llVertex + 1, llVertex + 2, llVertex - numLongSteps + 2);
            } // end for each latitude
            for (var whichLong = llVertex + 2; whichLong < llVertex + numLongSteps + 1; whichLong++) // north pole
                ellipsoidTriangles.push(whichLong, ellipsoidVertices.length / 3 - 1, whichLong + 1);
            ellipsoidTriangles.push(ellipsoidVertices.length / 3 - 2, ellipsoidVertices.length / 3 - 1,
                ellipsoidVertices.length / 3 - numLongSteps - 1); // longitude wrap
        } // end if good number longitude steps
        return ({ // bundle 
            vertices: ellipsoidVertices,
            normals: ellipsoidNormals,
            uvs: ellipsoidUVs,
            triangles: ellipsoidTriangles,
            texture: currEllipsoid.texture
        });
    } // end try

    catch (e) {
        console.log(e);
    } // end catch
} // end make ellipsoid


function loadEllipsoids(maxCorner, minCorner) {

    inputEllipsoids = getJSONFile(INPUT_ELLIPSOIDS_URL, "ellipsoids"); // read in the ellipsoids

    if (myScene) {
        inputEllipsoids = createMyEllipsoids();
    }

    if (inputEllipsoids == String.null)
        throw "Unable to load ellipsoids file!";
    else {

        // init ellipsoid highlighting, translation and rotation; update bbox
        var ellipsoid; // current ellipsoid
        var ellipsoidModel; // current ellipsoid triangular model
        var temp = vec3.create(); // an intermediate vec3
        var minXYZ = vec3.create(), maxXYZ = vec3.create();  // min/max xyz from ellipsoid
        numEllipsoids = inputEllipsoids.length; // remember how many ellipsoids
        for (var whichEllipsoid = 0; whichEllipsoid < numEllipsoids; whichEllipsoid++) {

            // set up various stats and transforms for this ellipsoid
            ellipsoid = inputEllipsoids[whichEllipsoid];
            ellipsoid.on = false; // ellipsoids begin without highlight
            ellipsoid.translation = vec3.fromValues(0, 0, 0); // ellipsoids begin without translation
            ellipsoid.xAxis = vec3.fromValues(1, 0, 0); // ellipsoid X axis
            ellipsoid.yAxis = vec3.fromValues(0, 1, 0); // ellipsoid Y axis 
            ellipsoid.center = vec3.fromValues(ellipsoid.x, ellipsoid.y, ellipsoid.z); // locate ellipsoid ctr
            vec3.set(minXYZ, ellipsoid.x - ellipsoid.a, ellipsoid.y - ellipsoid.b, ellipsoid.z - ellipsoid.c);
            vec3.set(maxXYZ, ellipsoid.x + ellipsoid.a, ellipsoid.y + ellipsoid.b, ellipsoid.z + ellipsoid.c);
            vec3.min(minCorner, minCorner, minXYZ); // update world bbox min corner
            vec3.max(maxCorner, maxCorner, maxXYZ); // update world bbox max corner

            // make the ellipsoid model
            ellipsoidModel = makeEllipsoid(ellipsoid, 32, minXYZ, maxXYZ, minCorner, maxCorner);

            console.log(
                "Center of this ellipsoid: " +
                ellipsoid.center[0] + ", " +
                ellipsoid.center[1] + ", " +
                ellipsoid.center[2]
            );

            // send the ellipsoid vertex coords and normals to webGL
            vertexBuffers.push(gl.createBuffer()); // init empty webgl ellipsoid vertex coord buffer
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[vertexBuffers.length - 1]); // activate that buffer
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ellipsoidModel.vertices), gl.STATIC_DRAW); // data in
            normalBuffers.push(gl.createBuffer()); // init empty webgl ellipsoid vertex normal buffer
            gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[normalBuffers.length - 1]); // activate that buffer
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ellipsoidModel.normals), gl.STATIC_DRAW); // data in
            uvBuffers.push(gl.createBuffer()); // init empty webgl ellipsoid vertex coord buffer
            gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffers[uvBuffers.length - 1]); // activate that buffer
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ellipsoidModel.uvs), gl.STATIC_DRAW); // data in

            textures.push(loadTexture(ellipsoid.texture).texture);

            triSetSizes.push(ellipsoidModel.triangles.length);

            // send the triangle indices to webGL
            triangleBuffers.push(gl.createBuffer()); // init empty triangle index buffer
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[triangleBuffers.length - 1]); // activate that buffer
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(ellipsoidModel.triangles), gl.STATIC_DRAW); // data in
        } // end for each ellipsoid

        viewDelta = vec3.length(vec3.subtract(temp, maxCorner, minCorner)) / 100; // set global
    } // end if ellipsoid file loaded
}

// read models in, load them into webgl buffers
function loadModels() {

    inputTriangles = []; // the triangle data as loaded from input files
    numTriangleSets = 0; // how many triangle sets in input scene
    inputEllipsoids = []; // the ellipsoid data as loaded from input files
    numEllipsoids = 0; // how many ellipsoids in the input scene
    vertexBuffers = []; // this contains vertex coordinate lists by set, in triples
    normalBuffers = []; // this contains normal component lists by set, in triples
    uvBuffers = []; // this contains uv coordinate component lists by set, in doubles
    textures = []; // this contains the textures for each model
    triSetSizes = []; // this contains the size of each triangle set
    triangleBuffers = []; // lists of indices into vertexBuffers by set, in triples
    viewDelta = 0; // how much to displace view with each key press

    var maxCorner = vec3.fromValues(Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE); // bbox corner
    var minCorner = vec3.fromValues(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE); // other corner

    try {
        loadTriangles(maxCorner, minCorner);
        loadEllipsoids(maxCorner, minCorner);
    } // end try 
    catch (e) {
        console.log(e);
    } // end catch
} // end load models

// setup the webGL shaders
function setupShaders() {

    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 a_vertexPosition; // vertex position
        attribute vec3 a_vertexNormal; // vertex normal
        attribute vec2 a_vertexUV; // vertex texture uv
        
        uniform mat4 u_mMatrix; // the model matrix
        uniform mat4 u_pvmMatrix; // the project view model matrix
        
        varying vec3 v_worldPos; // interpolated world position of vertex
        varying vec3 v_vertexNormal; // interpolated normal for frag shader
        varying vec2 v_vertexUV; // interpolated texture uv for frag shader

        void main(void) {
            
            // vertex position
            vec4 v_worldPos4 = u_mMatrix * vec4(a_vertexPosition, 1.0);
            v_worldPos = vec3(v_worldPos4.x, v_worldPos4.y, v_worldPos4.z);
            gl_Position = u_pvmMatrix * vec4(a_vertexPosition, 1.0);            

            // vertex normal (assume no non-uniform scale)
            vec4 v_worldNormal4 = u_mMatrix * vec4(a_vertexNormal, 0.0);
            v_vertexNormal = normalize( vec3( v_worldNormal4.x, v_worldNormal4.y, v_worldNormal4.z)); 

            // vertex uv texture coordinate
            v_vertexUV = a_vertexUV;
        }
    `;

    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        precision mediump float; // set float to medium precision

        // eye location
        uniform vec3 u_eyePosition; // the eye's position in world
        
        // light properties
        uniform vec3 u_lightAmbient; // the light's ambient color
        uniform vec3 u_lightDiffuse; // the light's diffuse color
        uniform vec3 u_lightSpecular; // the light's specular color
        uniform vec3 u_lightPosition; // the light's position
        
        // material properties
        uniform vec3 u_ambient; // the ambient reflectivity
        uniform vec3 u_diffuse; // the diffuse reflectivity
        uniform vec3 u_specular; // the specular reflectivity
        uniform float u_shininess; // the specular exponent
        uniform float u_alpha; // alpha for transparency

        // texture properties
        uniform sampler2D u_uvSampler;
        uniform int u_blendingMode;
        uniform bool u_transparencyPass;
        uniform bool u_useTransparency;
        
        // geometry properties
        varying vec3 v_worldPos; // world xyz of fragment
        varying vec3 v_vertexNormal; // normal of fragment
        varying vec2 v_vertexUV; // texture uv of fragment
            
        void main(void) {
        
            // ambient term
            vec3 ambient = u_ambient * u_lightAmbient; 
            
            // diffuse term
            vec3 normal = normalize(v_vertexNormal); 
            vec3 light = normalize(u_lightPosition - v_worldPos);
            float lambert = max( 0.0, dot(normal, light) );
            vec3 diffuse = u_diffuse * u_lightDiffuse * lambert; // diffuse term
            
            // specular term
            vec3 eye = normalize(u_eyePosition - v_worldPos);
            vec3 halfVec = normalize(light + eye);
            float highlight = pow( max( 0.0, dot(normal, halfVec) ), u_shininess );
            vec3 specular = u_specular * u_lightSpecular * highlight; // specular term

            // get texture color from uv
            vec4 texColor = texture2D(u_uvSampler, v_vertexUV);
            
            vec3 lightColor = ambient + diffuse + specular; // no specular yet

            vec4 finalColor = vec4(0.0, 0.0, 0.0, 1.0);
            if(u_useTransparency && !u_transparencyPass && (u_alpha < 1.0 || texColor.a < 1.0)) {
                discard;
            } 

            if(u_blendingMode == 0) {
                finalColor = vec4(texColor * vec4(lightColor, u_alpha));
            }
            else if(u_blendingMode == 1) {
                finalColor = vec4(texColor);
            }
            else if(u_blendingMode == 2) {
                finalColor = vec4(lightColor, u_alpha);
            }
            else {
                float depth = 1.0 - (gl_FragCoord.z * gl_FragCoord.z); // square to appear brighter
                finalColor = vec4(depth, depth, depth, 1.0);
            }

            if(!u_useTransparency) {
                finalColor.a = 1.0;
            }

            gl_FragColor = finalColor; 
        }
    `;

    try {
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader, fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader, vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution

        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);
            gl.deleteShader(vShader);
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)

                // locate and enable vertex attributes
                vPosAttribLoc = gl.getAttribLocation(shaderProgram, "a_vertexPosition"); // ptr to vertex pos attrib
                gl.enableVertexAttribArray(vPosAttribLoc); // connect attrib to array
                vNormAttribLoc = gl.getAttribLocation(shaderProgram, "a_vertexNormal"); // ptr to vertex normal attrib
                gl.enableVertexAttribArray(vNormAttribLoc); // connect attrib to array
                vUVAttribLoc = gl.getAttribLocation(shaderProgram, "a_vertexUV"); // ptr to vertex uv coordinate attrib
                gl.enableVertexAttribArray(vUVAttribLoc); // connect attrib to array

                // locate vertex uniforms
                mMatrixULoc = gl.getUniformLocation(shaderProgram, "u_mMatrix"); // ptr to mmat
                pvmMatrixULoc = gl.getUniformLocation(shaderProgram, "u_pvmMatrix"); // ptr to pvmmat

                // locate fragment uniforms
                var eyePositionULoc = gl.getUniformLocation(shaderProgram, "u_eyePosition"); // ptr to eye position
                var lightAmbientULoc = gl.getUniformLocation(shaderProgram, "u_lightAmbient"); // ptr to light ambient
                var lightDiffuseULoc = gl.getUniformLocation(shaderProgram, "u_lightDiffuse"); // ptr to light diffuse
                var lightSpecularULoc = gl.getUniformLocation(shaderProgram, "u_lightSpecular"); // ptr to light specular
                var lightPositionULoc = gl.getUniformLocation(shaderProgram, "u_lightPosition"); // ptr to light position
                ambientULoc = gl.getUniformLocation(shaderProgram, "u_ambient"); // ptr to ambient
                diffuseULoc = gl.getUniformLocation(shaderProgram, "u_diffuse"); // ptr to diffuse
                specularULoc = gl.getUniformLocation(shaderProgram, "u_specular"); // ptr to specular
                shininessULoc = gl.getUniformLocation(shaderProgram, "u_shininess"); // ptr to shininess
                alphaULoc = gl.getUniformLocation(shaderProgram, "u_alpha");

                textureULoc = gl.getUniformLocation(shaderProgram, "u_uvSampler"); // ptr to texture sampler
                transparencyPassULoc = gl.getUniformLocation(shaderProgram, "u_transparencyPass");
                useTransparencyULoc = gl.getUniformLocation(shaderProgram, "u_useTransparency");

                blendModeULoc = gl.getUniformLocation(shaderProgram, "u_blendingMode"); // ptr to texture/lighting blending mode integer

                // pass global constants into fragment uniforms
                gl.uniform3fv(eyePositionULoc, Eye); // pass in the eye's position
                gl.uniform3fv(lightAmbientULoc, lightAmbient); // pass in the light's ambient emission
                gl.uniform3fv(lightDiffuseULoc, lightDiffuse); // pass in the light's diffuse emission
                gl.uniform3fv(lightSpecularULoc, lightSpecular); // pass in the light's specular emission
                gl.uniform3fv(lightPositionULoc, lightPosition); // pass in the light's position
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 

    catch (e) {
        console.log(e);
    } // end catch
} // end setup shaders

// construct the model transform matrix, based on model state
function makeModelTransform(currModel, mMatrix) {

    var zAxis, sumRotation, temp, negCtr;
    zAxis = vec3.create();
    sumRotation = mat4.create();
    temp = mat4.create();
    negCtr = vec3.create();

    // move the model to the origin
    mat4.fromTranslation(mMatrix, vec3.negate(negCtr, currModel.center));

    // scale for highlighting if needed
    if (currModel.on)
        mat4.multiply(mMatrix, mat4.fromScaling(temp, vec3.fromValues(1.2, 1.2, 1.2)), mMatrix); // S(1.2) * T(-ctr)

    // rotate the model to current interactive orientation
    vec3.normalize(zAxis, vec3.cross(zAxis, currModel.xAxis, currModel.yAxis)); // get the new model z axis
    mat4.set(sumRotation, // get the composite rotation
        currModel.xAxis[0], currModel.yAxis[0], zAxis[0], 0,
        currModel.xAxis[1], currModel.yAxis[1], zAxis[1], 0,
        currModel.xAxis[2], currModel.yAxis[2], zAxis[2], 0,
        0, 0, 0, 1);
    mat4.multiply(mMatrix, sumRotation, mMatrix); // R(ax) * S(1.2) * T(-ctr)

    // translate back to model center
    mat4.multiply(mMatrix, mat4.fromTranslation(temp, currModel.center), mMatrix); // T(ctr) * R(ax) * S(1.2) * T(-ctr)

    // translate model to current interactive orientation
    mat4.multiply(mMatrix, mat4.fromTranslation(temp, currModel.translation), mMatrix); // T(pos)*T(ctr)*R(ax)*S(1.2)*T(-ctr)

} // end make model transform


function renderPass(transparency) {
    // var hMatrix = mat4.create(); // handedness matrix
    var pMatrix = mat4.create(); // projection matrix
    var vMatrix = mat4.create(); // view matrix
    var mMatrix = mat4.create(); // model matrix
    var pvMatrix = mat4.create(); // hand * proj * view matrices
    var pvmMatrix = mat4.create(); // hand * proj * view * model matrices

    gl.uniform1i(transparencyPassULoc, transparency);

    // set up projection and view
    // mat4.fromScaling(hMatrix,vec3.fromValues(-1,1,1)); // create handedness matrix
    mat4.perspective(pMatrix, 0.5 * Math.PI, 1, 0.1, 10); // create projection matrix
    mat4.lookAt(vMatrix, Eye, Center, Up); // create view matrix
    mat4.multiply(pvMatrix, pvMatrix, pMatrix); // projection
    mat4.multiply(pvMatrix, pvMatrix, vMatrix); // projection * view

    // render each triangle set
    var currSet; // the tri set and its material properties
    for (var whichTriSet = 0; whichTriSet < numTriangleSets; whichTriSet++) {
        currSet = inputTriangles[whichTriSet];

        // make model transform, add to view project
        makeModelTransform(currSet, mMatrix);
        mat4.multiply(pvmMatrix, pvMatrix, mMatrix); // project * view * model
        gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in the m matrix
        gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in the hpvm matrix

        // reflectivity: feed to the fragment shader
        gl.uniform3fv(ambientULoc, currSet.material.ambient); // pass in the ambient reflectivity
        gl.uniform3fv(diffuseULoc, currSet.material.diffuse); // pass in the diffuse reflectivity
        gl.uniform3fv(specularULoc, currSet.material.specular); // pass in the specular reflectivity
        gl.uniform1f(shininessULoc, currSet.material.n); // pass in the specular exponent
        gl.uniform1f(alphaULoc, currSet.material.alpha);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textures[whichTriSet]);
        gl.uniform1i(textureULoc, 0);

        // vertex buffer: activate and feed into vertex shader
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[whichTriSet]); // activate
        gl.vertexAttribPointer(vPosAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[whichTriSet]); // activate
        gl.vertexAttribPointer(vNormAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed
        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffers[whichTriSet]); // activate
        gl.vertexAttribPointer(vUVAttribLoc, 2, gl.FLOAT, false, 0, 0); // feed

        // triangle buffer: activate and render
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichTriSet]); // activate
        gl.drawElements(gl.TRIANGLES, 3 * triSetSizes[whichTriSet], gl.UNSIGNED_SHORT, 0); // render

    } // end for each triangle set


    // render each ellipsoid
    var ellipsoid, instanceTransform = mat4.create(); // the current ellipsoid and material

    for (var whichEllipsoid = 0; whichEllipsoid < numEllipsoids; whichEllipsoid++) {
        ellipsoid = inputEllipsoids[whichEllipsoid];
        var index = numTriangleSets + whichEllipsoid;

        // define model transform, premult with pvmMatrix, feed to vertex shader
        makeModelTransform(ellipsoid, mMatrix);
        pvmMatrix = mat4.multiply(pvmMatrix, pvMatrix, mMatrix); // premultiply with pv matrix
        gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in model matrix
        gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in project view model matrix

        // reflectivity: feed to the fragment shader
        gl.uniform3fv(ambientULoc, ellipsoid.ambient); // pass in the ambient reflectivity
        gl.uniform3fv(diffuseULoc, ellipsoid.diffuse); // pass in the diffuse reflectivity
        gl.uniform3fv(specularULoc, ellipsoid.specular); // pass in the specular reflectivity
        gl.uniform1f(shininessULoc, ellipsoid.n); // pass in the specular exponent
        gl.uniform1f(alphaULoc, ellipsoid.alpha);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textures[index]);
        gl.uniform1i(textureULoc, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[index]); // activate vertex buffer
        gl.vertexAttribPointer(vPosAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed vertex buffer to shader
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[index]); // activate normal buffer
        gl.vertexAttribPointer(vNormAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed normal buffer to shader
        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffers[index]); // activate uv coordinate buffer
        gl.vertexAttribPointer(vUVAttribLoc, 2, gl.FLOAT, false, 0, 0); // feed uv buffer to shader


        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[index]); // activate tri buffer
        // draw a transformed instance of the ellipsoid
        gl.drawElements(gl.TRIANGLES, triSetSizes[numTriangleSets + whichEllipsoid], gl.UNSIGNED_SHORT, 0); // render
    } // end for each ellipsoid
}
// render the loaded model
function renderModels() {
    window.requestAnimationFrame(renderModels); // set up frame render callback

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers

    gl.uniform1i(blendModeULoc, blendingMode); // pass in the color/texture blending mode
    gl.uniform1i(useTransparencyULoc, transparency);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    renderPass(false);

    if (transparency) {
        // second pass for transparency
        gl.depthMask(false);
        gl.enable(gl.BLEND);
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFunc(gl.ONE_MINUS_CONSTANT_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        renderPass(true);
    }

} // end render model


/* MAIN -- HERE is where execution begins after window load */

function main() {

    setupWebGL(); // set up the webGL environment
    loadModels(); // load in the models from tri file
    setupShaders(); // setup the webGL shaders
    renderModels(); // draw the triangles using webGL

} // end main


// apologies for this but I couldn't figure out hosting my own JSON files externally
// I tried using my github to host both the triangles/ellipsoids but the resources won't load; however images work fine
// in the interest of simplicity I'm just going to create my scene with functions directly instead
// Considering how long this file already is I don't think it's that bad to extend it a few more lines

// The scene isn't all that complex: just a cubic room with (goofy) textured walls, some of which are transparent overlays over a opaque background
// I am kind of proud of the floating globe in the middle though

function createMyTriangles() {

    return (
        [
            {
                material: { ambient: [0.1, 0.1, 0.1], diffuse: [0.4, 0.4, 0.4], specular: [0.3, 0.3, 0.3], n: 11, alpha: 1.0, texture: "https://i.redd.it/cs8xid8pjno31.png" },
                vertices: [[-2, 0, 1.98], [-2, 4, 1.98], [2, 4, 1.98], [2, 0, 1.98]],
                normals: [[0, 0, -1], [0, 0, -1], [0, 0, -1], [0, 0, -1]],
                uvs: [[1, 0], [1, 1], [0, 1], [0, 0]],
                triangles: [[0, 1, 2], [0, 2, 3]]
            },
            {
                material: { ambient: [0.1, 0.1, 0.1], diffuse: [0.7, 0.7, 0.0], specular: [0.3, 0.3, 0.3], n: 11, alpha: 1.0, texture: "stars.jpg" },
                vertices: [[-2, 0, 2], [-2, 4, 2], [2, 4, 2], [2, 0, 2]],
                normals: [[0, 0, -1], [0, 0, -1], [0, 0, -1], [0, 0, -1]],
                uvs: [[0, 0], [0, 1], [1, 1], [1, 0]],
                triangles: [[0, 1, 2], [0, 2, 3]]
            },
            {
                material: { ambient: [0.3, 0.3, 0.3], diffuse: [0.8, 0.8, 0.8], specular: [0.3, 0.3, 0.3], n: 11, alpha: 1.0, texture: "https://i.redd.it/6rfyaxxhuel61.png" },
                vertices: [[2, 0, 2], [2, 4, 2], [2, 4, -2], [2, 0, -2]],
                normals: [[-1, 0, 0], [-1, 0, 0], [-1, 0, 0], [-1, 0, 0]],
                uvs: [[1, 0], [1, 1], [0, 1], [0, 0]],
                triangles: [[0, 1, 2], [0, 2, 3]]
            },
            {
                material: { ambient: [0.3, 0.3, 0.3], diffuse: [0.2, 0.4, 0.2], specular: [0.3, 0.3, 0.3], n: 11, alpha: 1.0, texture: "tree.png" },
                vertices: [[-1.98, 0, 2], [-1.98, 4, 2], [-1.98, 4, -2], [-1.98, 0, -2]],
                normals: [[1, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]],
                uvs: [[0, 0], [0, 1], [1, 1], [1, 0]],
                triangles: [[0, 1, 2], [0, 2, 3]]
            },
            {
                material: { ambient: [0.3, 0.3, 0.3], diffuse: [0.0, 0.7, 0.7], specular: [0.3, 0.3, 0.3], n: 11, alpha: 1.0, texture: "stars.jpg" },
                vertices: [[-2, 0, 2], [-2, 4, 2], [-2, 4, -2], [-2, 0, -2]],
                normals: [[1, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]],
                uvs: [[0, 0], [0, 1], [1, 1], [1, 0]],
                triangles: [[0, 1, 2], [0, 2, 3]]
            },
            {
                material: { ambient: [0.1, 0.1, 0.1], diffuse: [0.9, 0.9, 0.9], specular: [0.3, 0.3, 0.3], n: 11, alpha: 1.0, texture: "rocktile.jpg" },
                vertices: [[-2, 0, -2], [-2, 0, 2], [2, 0, 2], [2, 0, -2]],
                normals: [[0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0]],
                uvs: [[0, 0], [0, 1], [1, 1], [1, 0]],
                triangles: [[0, 1, 2], [0, 2, 3]]
            },
            {
                material: { ambient: [0.1, 0.1, 0.1], diffuse: [0.3, 0.3, 0.3], specular: [0.3, 0.3, 0.3], n: 11, alpha: 1.0, texture: "https://upload.wikimedia.org/wikipedia/en/2/24/North_Carolina_State_University_seal.svg" },
                vertices: [[-1, 0.01, -1], [-1, 0.01, 1], [1, 0.01, 1], [1, 0.01, -1]],
                normals: [[0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0]],
                uvs: [[0, 0], [0, 1], [1, 1], [1, 0]],
                triangles: [[0, 1, 2], [0, 2, 3]]
            },
            {
                material: { ambient: [0.1, 0.1, 0.1], diffuse: [0.9, 0.9, 0.9], specular: [0.3, 0.3, 0.3], n: 11, alpha: 0.8, texture: "stars.jpg" },
                vertices: [[-2, 4, -2], [-2, 4, 2], [2, 4, 2], [2, 4, -2]],
                normals: [[0, -1, 0], [0, -1, 0], [0, -1, 0], [0, -1, 0]],
                uvs: [[0, 0], [0, 1], [1, 1], [1, 0]],
                triangles: [[0, 1, 2], [0, 2, 3]]
            },
            {
                material: { ambient: [0.7, 0.7, 0.7], diffuse: [0.2, 0.4, 0.2], specular: [0.3, 0.3, 0.3], n: 11, alpha: 1.0, texture: "https://t4.ftcdn.net/jpg/07/71/17/11/360_F_771171175_4hD5F0gFznDfudqIolxHo7If0qa1D6Za.jpg" },
                vertices: [[-2, 0, -2], [-2, 4, -2], [2, 4, -2], [2, 0, -2]],
                normals: [[0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1]],
                uvs: [[0, 0], [0, 1], [1, 1], [1, 0]],
                triangles: [[0, 1, 2], [0, 2, 3]]
            },
        ]
    );

}

function createMyEllipsoids() {
    return (
        [
            { x: 0.0, y: 0.4, z: 0.0, a: 0.4, b: 0.4, c: 0.4, ambient: [0.3, 0.3, 0.3], diffuse: [0.0, 0.5, 0.1], specular: [0.3, 0.3, 0.3], n: 5, alpha: 1, texture: "earth.png" },
            { x: 0.0, y: 0.4, z: 0.0, a: 0.398, b: 0.398, c: 0.398, ambient: [0.2, 0.2, 0.6], diffuse: [0.2, 0.2, 0.6], specular: [0.5, 0.5, 0.5], n: 20, alpha: 1, texture: "https://www.manytextures.com/thumbnail/30/512/rough-sea.jpg" },
            { x: 0.0, y: 0.4, z: 0.0, a: 0.415, b: 0.415, c: 0.415, ambient: [0.4, 0.4, 0.4], diffuse: [0.5, 0.5, 0.5], specular: [0.1, 0.1, 0.1], n: 2, alpha: 0.1, texture: "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/i/54d29bda-085e-44fc-b3e9-8c14f0695e6c/dc70dkn-a88ac194-06a6-42a9-ae4f-91fab1cf0974.png" }
        ]
    );
}

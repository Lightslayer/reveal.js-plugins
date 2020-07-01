/*****************************************************************
** Author: Asvin Goel, goel@telematique.eu
**
** The slide show recorder is a plugin for reveal.js allowing to
** record audio for a slide deck. 
**
** Version: 0.4
** 
** License: MIT license (see LICENSE.md)
**
** Credits:
** - Muaz Khan for RecordRTC.js 
** - Stuart Knightley for JSzip.js
******************************************************************/

/*****************************************************************
** jszip.js
******************************************************************/
/*!
JSZip - A Javascript class for generating and reading zip files
<http://stuartk.com/jszip>
(c) 2009-2014 Stuart Knightley <stuart [at] stuartk.com>
Dual licenced under the MIT license or GPLv3. See https://raw.github.com/Stuk/jszip/master/LICENSE.markdown.
JSZip uses the library pako released under the MIT license :
https://github.com/nodeca/pako/blob/master/LICENSE
*/

var Recorder = {
    audio: null,
    audioStream: null,
    recordRTC: null,
    zip: null,
    indices: null,
    recordedAudio: null,
    canvas: null,
    isRecording: false,
    isPaused: false,

    initialize : function initialize() {
	this.audio = new Audio();
	this.audio.autoplay = true;
	this.zip = null;

	// Create canvas on which red circle can be drawn
	this.canvas = document.createElement( 'canvas' );
	this.canvas.className = 'recorder';
	this.canvas.setAttribute( 'style', "position: fixed; top: 25px; right: 50px;" );
	this.canvas.width = 25;
	this.canvas.height = 25;
	document.querySelector( '.reveal' ).appendChild( this.canvas );
	    
	try {
  		this.zip = new JSZip();
	}
	catch(err) {
  		console.error(err);
	} 

    }, 

    toggleRecording: function toggleRecording( override ) {
	var wasRecording = this.isRecording;
	if( typeof override === 'boolean' ) {
		this.isRecording = override;
		this.isPaused = false;
	}
	else {
		this.isRecording = !this.isRecording;
	}
	// turn of recording if overview is shown or screen is black
	this.isRecording = ( this.isRecording && !Reveal.isOverview() && !Reveal.isPaused() );

	if ( !wasRecording && this.isRecording ) {
		this.start();
	}
	else if ( wasRecording && !this.isRecording) {
		this.stop();
	}
    },

    start : function start() {
	window.onbeforeunload = confirmExit;
  	function confirmExit()
  	{
    		return "You have attempted to leave this page. All unsaved audio recordings will be lost. Are you sure you want to exit this page?";
  	}

	this.indices = Reveal.getIndices();

	// determine audio element for slide
	var id = "audioplayer-" + this.indices.h + "." + this.indices.v;
	if ( this.indices.f != undefined && this.indices.f >= 0 ) id = id + "." + this.indices.f;
	this.recordedAudio = document.getElementById( id );
	if ( !this.recordedAudio ) {
		alert("Audio player is not found. Please check that audio-slideshow plugin is loaded!");
	}

	if ( !this.audioStream || !this.recordRTC ) { 
		navigator.getUserMedia( { audio: true, video: false }, function( stream ) {
			if ( window.IsChrome ) stream = new window.MediaStream( stream.getAudioTracks() );
			Recorder.audioStream = stream;
			Recorder.recordRTC = window.RecordRTC( stream, { type: 'audio' }, { bufferSize: 256 } );
			Recorder.recordRTC.startRecording();
			// Draw red circle over auto slide control
			var context = Recorder.canvas.getContext( '2d' );
			context.beginPath();
			context.arc( ( Recorder.canvas.width / 2 ), ( Recorder.canvas.height / 2 ), ( Recorder.canvas.width / 2 ) - 3, 0, Math.PI * 2, false );
			context.lineWidth = 3;
			context.fillStyle = '#f00';
			context.fill();
			context.strokeStyle = '#f00';
			context.stroke();
			// Let others know recording has started
			document.dispatchEvent( new CustomEvent('startrecording') );
		}, function( error ) {
			alert( 'Something went wrong in accessing the microphone. (error code ' + error.code + ')' );
		} );
	}
	else {
//		this.audio.src = URL.createObjectURL( this.audioStream ); // deprecated since FF54
		this.audio.srcObject = this.audioStream;
		this.audio.volume = 0.0;
		this.recordRTC.startRecording();
		// Draw red circle over auto slide control
		var context = this.canvas.getContext( '2d' );
		context.beginPath();
		context.arc( ( this.canvas.width / 2 ), ( this.canvas.height / 2 ), ( this.canvas.width / 2 ) - 3, 0, Math.PI * 2, false );
		context.lineWidth = 3;
		context.fillStyle = '#f00';
		context.fill();
		context.strokeStyle = '#f00';
		context.stroke();
		// Let others know recording has started
		document.dispatchEvent( new CustomEvent('startrecording') );
	}
    },

    stop : function stop() {
	this.audio.src = '';
	if ( this.recordRTC ) {

		this.filename = this.indices.h + '.' + this.indices.v;
		if ( ( typeof this.indices.f != 'undefined' && this.indices.f >= 0) ) this.filename = this.filename + '.' + this.indices.f;

		this.recordRTC.stopRecording( function( url ) {
			// add audio URL to slide
			Recorder.recordedAudio.src = url;

			// add audio to zip
			var blob = Recorder.recordRTC.getBlob();

			Recorder.filename = Recorder.filename + '.' + blob.type.split( '/' ).pop();
			var reader = new window.FileReader();
			reader.readAsBinaryString(blob); 
			reader.onloadend = function() {
				blobBinaryString = reader.result; 
				Recorder.zip.file( Recorder.filename, blobBinaryString, { binary: true } );
				Recorder.filename = null;
			}
		} );
		this.indices = null;	
		
	}

	// Remove red circle over auto slide control
	var context = this.canvas.getContext( '2d' );
	context.clearRect ( 0 , 0 , this.canvas.width , this.canvas.height );
	// Let others know recording has stopped
	document.dispatchEvent( new CustomEvent('stoprecording') );
    },

    next : function next() {
	// Remove red or yellow circle
	var context = this.canvas.getContext( '2d' );
	context.clearRect ( 0 , 0 , this.canvas.width , this.canvas.height );

	this.audio.src = '';

	if ( this.recordRTC ) {
		this.filename = this.indices.h + '.' + this.indices.v;
		if ( ( typeof this.indices.f != 'undefined' && this.indices.f >= 0) ) {
			this.filename = this.filename + '.' + this.indices.f;
		}
		this.recordRTC.stopRecording( function( url ) {
			// add audio URL to slide
			Recorder.recordedAudio.src = url;
			// add audio to zip
			var blob = Recorder.recordRTC.getBlob();

			Recorder.filename = Recorder.filename + '.' + blob.type.split( '/' ).pop();
			var reader = new window.FileReader();
			reader.readAsBinaryString(blob); 
			reader.onloadend = function() {
				blobBinaryString = reader.result; 
				Recorder.zip.file( Recorder.filename, blobBinaryString, { binary: true } );
				Recorder.filename = null;
				if ( !Recorder.isPaused ) Recorder.start();
			}
		} );		
	}

	if ( this.isPaused ) {
 		// Draw yellow circle over auto slide control
		var context = this.canvas.getContext( '2d' );
		context.beginPath();
		context.arc( ( this.canvas.width / 2 ), ( this.canvas.height / 2 ), ( this.canvas.width / 2 ) - 3, 0, Math.PI * 2, false );
		context.lineWidth = 3;
		context.fillStyle = '#ff0';
		context.fill();
		context.strokeStyle = '#ff0';
		context.stroke();
	}
	
    },

    downloadZip : function downloadZip() {
	var a = document.createElement('a');
	document.body.appendChild(a);	
	try {
	  a.download = "audio.zip";
	  var blob = this.zip.generate( {type:"blob"} );
	  a.href = window.URL.createObjectURL( blob );
  	} catch( error ) {
 	  a.innerHTML += " (" + error + ")";
 	}
	a.click();
	document.body.removeChild(a);
    },

    fetchTTS : function fetchTTS() {
	function fetchAudio( audioSources ) {
		if ( audioSources.length ) {
			// take first audio from array
			var audioSource = audioSources.shift();
			var progress = Math.round(100 * ( progressBar.getAttribute( 'data-max' ) - audioSources.length ) / progressBar.getAttribute( 'data-max' ) );  
			progressBar.setAttribute( 'style', "width: " + progress + "%" );
			var filename = audioSource.getAttribute('data-tts');
	 		var xhr = new XMLHttpRequest();
			xhr.open('GET', audioSource.src, true);
	 		xhr.responseType = 'blob';
 			xhr.onload = function() {
   				if (xhr.readyState === 4 && xhr.status === 200) {
	      				var blobURL = window.URL.createObjectURL(xhr.response);
					filename += '.' + xhr.response.type.split( '/' ).pop().split( 'x-' ).pop();
	      				// convert blob to binary string
					var reader = new window.FileReader();
					reader.readAsBinaryString(xhr.response); 
					reader.onloadend = function() {
						blobBinaryString = reader.result; 
						// add blob to zip
						Recorder.zip.file( filename, blobBinaryString, { binary: true } );
						// fetch next audio file
						fetchAudio( audioSources );
					}
	   			}
	 		}
			xhr.onerror = function() {
				alert ( "Unable to fetch TTS-files!" );
				// remove progress bar
				document.querySelector( ".reveal" ).removeChild( progressContainer );
			}
			try {
				xhr.send(null); // fetch TTS
				console.log("Fetch TTS for slide " + audioSource.getAttribute('data-tts'));
			} catch ( error ) { 
				alert ( "Unable to fetch TTS-files! " + error ); 
				// remove progress bar
				document.querySelector( ".reveal" ).removeChild( progressContainer );
			}
		}
		else {
			// generate zip for download
			var blob = Recorder.zip.generate( {type:"blob"} );
			var a = document.createElement('a');
			document.body.appendChild(a);	
			try {
				a.download = "audio.zip";
				a.href = window.URL.createObjectURL( blob );
			} catch( error ) {
				a.innerHTML += " (" + error + ")";
 			}
			a.click();
			document.body.removeChild(a);
			// remove progress bar
			document.querySelector( ".reveal" ).removeChild( progressContainer );
		}
	}

	var TTS = document.querySelectorAll('audio>source[data-tts]');
	if ( TTS.length ) {
		// show progress bar
		var progressContainer =  document.createElement( 'div' );
		progressContainer.className = "progress";
		progressContainer.setAttribute( 'style', "display: block; top: 0; bottom: auto; height: 12px;" );
		var progressBar =  document.createElement( 'span' );
		progressBar.setAttribute( 'style', "width: 0%;" );
		progressBar.setAttribute( 'data-max', TTS.length );
		progressContainer.appendChild( progressBar );
		document.querySelector( ".reveal" ).appendChild( progressContainer );

		fetchAudio( Array.prototype.slice.call(TTS) );
	}
	else {
		alert("Either there is no audio to fetch from the text to speech generator or all audio files are already provided.");
	}
    }

};


(function(){


	Reveal.addEventListener( 'fragmentshown', function( event ) {
		if ( Recorder.isRecording ) {
			if ( recordedAudioExists( Reveal.getIndices() ) ) {
				Recorder.isPaused = true;
				Recorder.next();
			}
			else if ( Recorder.isPaused ) {
				// resume recording
				Recorder.isPaused = false;				
				Recorder.start();
			}
			else {
				Recorder.next();
			}
		}
	} );

	Reveal.addEventListener( 'fragmenthidden', function( event ) {
		if ( Recorder.isRecording ) {
			if ( recordedAudioExists( Reveal.getIndices() ) ) {
				Recorder.isPaused = true;
				Recorder.next();
			}
			else if ( Recorder.isPaused ) {
				// resume recording
				Recorder.isPaused = false;				
				Recorder.start();
			}
			else {
				Recorder.next();
			}
		}
	} );
	Reveal.addEventListener( 'overviewshown', function( event ) {
		Recorder.toggleRecording( false );
	} );

	Reveal.addEventListener( 'paused', function( event ) {
		Recorder.toggleRecording( false );
	} );

	Reveal.addEventListener( 'ready', function( event ) {
		Recorder.initialize();
	} );

	Reveal.addEventListener( 'slidechanged', function( event ) {
		if ( Recorder.isRecording ) {
			if ( recordedAudioExists( Reveal.getIndices() ) ) {
				Recorder.isPaused = true;
				Recorder.next();
			}
			else if ( Recorder.isPaused ) {
				// resume recording
				Recorder.isPaused = false;				
				Recorder.start();
			}
			else {
				Recorder.next();
			}
		}
	} );
			
	function recordedAudioExists( indices ) {
		var id = "audioplayer-" + indices.h + "." + indices.v;
		if ( indices.f != undefined && indices.f >= 0 ) id = id + "." + indices.f;
		return ( document.getElementById( id ).src.substring(0,4) == "blob"); 
	}

})();

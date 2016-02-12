(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.ReactImageLightbox = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*
 * react-image-lightbox 1.0.0
 * Copyright 2016 Chris Fritz All rights reserved.
 * @license Open source under the MIT License
 */
'use strict';

var React = (typeof window !== "undefined" ? window['React'] : typeof global !== "undefined" ? global['React'] : null);

module.exports = React.createClass({displayName: "exports",
    propTypes: {
        ///////////////////////////////
        // Image sources
        ///////////////////////////////

        // Main display image url
        mainSrc: React.PropTypes.string.isRequired,

        // Previous display image url (displayed to the left)
        // If left undefined, movePrev actions will not be performed, and the button not displayed
        prevSrc: React.PropTypes.string,

        // Next display image url (displayed to the right)
        // If left undefined, moveNext actions will not be performed, and the button not displayed
        nextSrc: React.PropTypes.string,

        ///////////////////////////////
        // Image thumbnail sources
        ///////////////////////////////

        // Thumbnail image url corresponding to props.mainSrc
        mainSrcThumbnail: React.PropTypes.string,

        // Thumbnail image url corresponding to props.prevSrc
        prevSrcThumbnail: React.PropTypes.string,

        // Thumbnail image url corresponding to props.nextSrc
        nextSrcThumbnail: React.PropTypes.string,

        ///////////////////////////////
        // Event Handlers
        ///////////////////////////////

        // Close window event
        // Should change the parent state such that the lightbox is not rendered
        onCloseRequest: React.PropTypes.func.isRequired,

        // Move to previous image event
        // Should change the parent state such that props.prevSrc becomes props.mainSrc,
        //  props.mainSrc becomes props.nextSrc, etc.
        onMovePrevRequest: React.PropTypes.func,

        // Move to next image event
        // Should change the parent state such that props.nextSrc becomes props.mainSrc,
        //  props.mainSrc becomes props.prevSrc, etc.
        onMoveNextRequest: React.PropTypes.func,

        ///////////////////////////////
        // Download discouragement settings
        ///////////////////////////////

        // Enable download discouragement (prevents [right-click -> Save Image As...])
        discourageDownloads: React.PropTypes.bool,

        ///////////////////////////////
        // Animation settings
        ///////////////////////////////

        // Disable all animation
        animationDisabled: React.PropTypes.bool,

        // Disable animation on actions performed with keyboard shortcuts
        animationOnKeyInput: React.PropTypes.bool,

        // Animation duration (ms)
        animationDuration: React.PropTypes.number,

        ///////////////////////////////
        // Keyboard shortcut settings
        ///////////////////////////////

        // Required interval of time (ms) between key actions
        // (prevents excessively fast navigation of images)
        keyRepeatLimit: React.PropTypes.number,

        // Amount of time (ms) restored after each keyup
        // (makes rapid key presses slightly faster than holding down the key to navigate images)
        keyRepeatKeyupBonus: React.PropTypes.number,

        ///////////////////////////////
        // Image info
        ///////////////////////////////

        // Image title
        imageTitle: React.PropTypes.string,

        ///////////////////////////////
        // Other
        ///////////////////////////////

        // Array of custom toolbar buttons
        toolbarButtons: React.PropTypes.arrayOf(React.PropTypes.node),

        // Padding (px) between the edge of the window and the lightbox
        imagePadding: React.PropTypes.number,
    },

    getDefaultProps: function() {
        return {
            onMovePrevRequest: function(){},
            onMoveNextRequest: function(){},

            discourageDownloads: false,

            animationDisabled   : false,
            animationOnKeyInput : false,
            animationDuration   : 300,

            keyRepeatLimit      : 180,
            keyRepeatKeyupBonus : 40,

            imagePadding: 10,
        };
    },

    getInitialState: function() {
        return {
            ///////////////////////////////
            // Animation
            ///////////////////////////////

            // Lightbox is closing
            // When Lightbox is mounted, if animation is enabled it will open with the reverse of the closing animation
            isClosing: !this.props.animationDisabled,

            // Main image is being replaced by the previous image
            isMovingToPrev: false,

            // Main image is being replaced by the next image
            isMovingToNext: false,
        };
    },

    componentWillMount: function() {
        // Whether event listeners for keyboard and mouse input have been attached or not
        this.listenersAttached = false;

        // Used to disable animation when changing props.mainSrc|nextSrc|prevSrc
        this.keyPressed = false;

        // Used to store load state / dimensions of images
        this.imageCache = {};

        // Time the last keydown event was called (used in keyboard action rate limiting)
        this.lastKeyDownTime = 0;
    },

    componentDidMount: function() {
        this.attachListeners();

        if (!this.props.animationDisabled) {
            // Make opening animation play
            this.setState({ isClosing: false });
        }

        this.loadAllImages();
    },

    componentWillReceiveProps: function(nextProps) {
        var sourcesChanged = this.getSrcTypes().some(function(srcType) {
            return this.props[srcType] != nextProps[srcType];
        }.bind(this));

        if (sourcesChanged) {
            // Enable animated states
            if (!this.props.animationDisabled && (!this.keyPressed || this.props.animationOnKeyInput)) {
                var movedToPrev = this.props.mainSrc == nextProps.nextSrc;
                if (this.props.mainSrc == nextProps.nextSrc) {
                    this.setState({ isMovingToPrev: true });
                    setTimeout(function() {
                        this.setState({ isMovingToPrev: false });
                    }.bind(this), this.props.animationDuration);
                } else if (this.props.mainSrc == nextProps.prevSrc) {
                    this.setState({ isMovingToNext: true });
                    setTimeout(function() {
                        this.setState({ isMovingToNext: false });
                    }.bind(this), this.props.animationDuration);
                }
            }
            this.keyPressed = false;

            // Load any new images
            this.loadAllImages(nextProps);
        }
    },

    componentWillUnmount: function() {
        this.detachListeners();
    },

    // Handle user keyboard actions
    handleKeyInput: function(event) {
        event.stopPropagation();

        // Ignore key input during animations
        if (this.isAnimating()) {
            return;
        }

        // Allow slightly faster navigation through the images when user presses keys repeatedly
        if (event.type === 'keyup') {
            this.lastKeyDownTime -= this.props.keyRepeatKeyupBonus;
            return;
        }

        var keyCode = event.which || event.keyCode;
        var key = {
            esc        : 27,
            leftArrow  : 37,
            rightArrow : 39,
        };

        // Ignore key presses that happen too close to each other (when rapid fire key pressing or holding down the key)
        // But allow it if it's a lightbox closing action
        var currentTime = new Date();
        if ((currentTime.getTime() - this.lastKeyDownTime) < this.props.keyRepeatLimit &&
            keyCode != key.esc
        ) {
            return;
        }
        this.lastKeyDownTime = currentTime.getTime();

        switch (keyCode) {
            // ESC key closes the lightbox
            case key.esc:
                event.preventDefault();
                if (this.props.animationDisabled || !this.props.animationOnKeyInput) {
                    this.props.onCloseRequest(event); // immediate
                } else {
                    this.requestClose(event); // animated
                }
                break;

            // Left arrow key moves to previous image
            case key.leftArrow:
                if (!this.props.prevSrc) {
                    return;
                }

                event.preventDefault();
                this.keyPressed = true;
                this.props.onMovePrevRequest(event);
                break;

            // Right arrow key moves to next image
            case key.rightArrow:
                if (!this.props.nextSrc) {
                    return;
                }

                event.preventDefault();
                this.keyPressed = true;
                this.props.onMoveNextRequest(event);
                break;

            default:
        }
    },

    // Request that the lightbox be closed
    requestClose: function(event) {
        var closeLightbox = function() {
            // Call the parent close request
            this.props.onCloseRequest(event);
        }.bind(this);

        if (!this.props.animationDisabled) {
            // Start closing animation
            this.setState({ isClosing: true });

            // Perform the actual closing at the end of the animation
            setTimeout(closeLightbox, this.props.animationDuration);
        } else {
            closeLightbox();
        }
    },

    // Request to transition to the previous image
    requestMovePrev: function(event) {
        this.props.onMovePrevRequest(event);
    },

    // Request to transition to the next image
    requestMoveNext: function(event) {
        this.props.onMoveNextRequest(event);
    },

    // Attach key and mouse input events
    attachListeners: function() {
        if (!this.listenersAttached) {
            document.addEventListener('keydown', this.handleKeyInput);
            document.addEventListener('keyup', this.handleKeyInput);
            this.listenersAttached = true;
        }
    },

    // Detach key and mouse input events
    detachListeners: function() {
        if (this.listenersAttached) {
            document.removeEventListener('keydown', this.handleKeyInput);
            document.removeEventListener('keyup', this.handleKeyInput);
            this.listenersAttached = false;
        }
    },

    // Get image src types
    getSrcTypes: function() {
        return [
            'mainSrc',
            'mainSrcThumbnail',
            'nextSrc',
            'nextSrcThumbnail',
            'prevSrc',
            'prevSrcThumbnail',
        ];
    },

    // Get sizing for when an image is larger than the window
    getFitSizes: function(width, height) {
        var windowHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
        var windowWidth  = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
        var maxHeight    = Math.min(windowHeight - (this.props.imagePadding * 2), height);
        var maxWidth     = Math.min(windowWidth - (this.props.imagePadding * 2), width);

        var maxRatio = maxWidth / maxHeight;
        var srcRatio = width / height;

        var fitSizes = {};
        if (maxRatio > srcRatio) { // height is the constraining dimension of the photo
            fitSizes.width  = width * maxHeight / height;
            fitSizes.height = maxHeight;
        } else {
            fitSizes.width  = maxWidth;
            fitSizes.height = height * maxWidth / width;
        }

        return fitSizes;
    },

    // Detach key and mouse input events
    isAnimating: function() {
        return this.state.isMovingToNext || this.state.isMovingToPrev || this.state.isClosing;
    },

    // Load image from src and call callback with image width and height on load
    loadImage: function(imageSrc, callback) {
        // Return the image info if it is already cached
        if (this.isImageLoaded(imageSrc)) {
            setTimeout(function() {
                callback(null, this.imageCache[imageSrc].width, this.imageCache[imageSrc].height);
            }, 1);
            return;
        }

        var that = this;
        var inMemoryImage = new Image();

        inMemoryImage.onerror = function() {
            callback('image load error');
        };

        inMemoryImage.onload = function() {
            that.imageCache[imageSrc] = {
                loaded : true,
                width  : this.width,
                height : this.height,
            };

            callback(null, this.width, this.height);
        };

        inMemoryImage.src = imageSrc;
    },

    // Load all images and their thumbnails
    loadAllImages: function(props) {
        props = props || this.props;
        var generateImageLoadedCallback = function(srcType, imageSrc) {
            return function(err) {
                // Give up showing image on error
                if (err) {
                    return;
                }

                // Don't rerender if the src is not the same as when the load started
                if (this.props[srcType] != imageSrc) {
                    return;
                }

                // Force rerender with the new image
                this.forceUpdate();
            }.bind(this);
        }.bind(this);

        // Load the images
        this.getSrcTypes().forEach(function(srcType) {
            // Load unloaded images
            if (props[srcType] && !this.isImageLoaded(props[srcType])) {
                this.loadImage(props[srcType], generateImageLoadedCallback(srcType, props[srcType]));
            }
        }.bind(this));
    },

    // Load image from src and call callback with image width and height on load
    isImageLoaded: function(imageSrc) {
        return imageSrc && (imageSrc in this.imageCache) && this.imageCache[imageSrc].loaded;
    },

    render: function() {
        // Transition settings for sliding animations
        var transitionStyle = 'none';
        if (!this.props.animationDisabled && this.isAnimating()) {
            transitionStyle = [
                'left '  + String(this.props.animationDuration) + 'ms',
                'right ' + String(this.props.animationDuration) + 'ms',
            ].join(', ');
        }

        // Images to be displayed
        var images = [];
        var addImage = function(srcType, imageClass) {
            var imageSrc = this.props[srcType];
            if (!imageSrc) {
                return;
            }

            var imageStyle = { transition : transitionStyle };
            var fitSizes = {};

            if (this.isImageLoaded(imageSrc)) {
                fitSizes = this.getFitSizes(this.imageCache[imageSrc].width, this.imageCache[imageSrc].height);
            } else if (this.isImageLoaded(this.props[srcType + 'Thumbnail'])) {
                // Fall back to using thumbnail if the image has not been loaded
                imageSrc = this.props[srcType + 'Thumbnail'];
                fitSizes = this.getFitSizes(this.imageCache[imageSrc].width, this.imageCache[imageSrc].height);
            } else {
                // Fall back to loading icon if the thumbnail has not been loaded
                images.push(
                    React.createElement("div", {
                        className: imageClass + ' not-loaded', 
                        style: imageStyle, 
                        key: imageSrc}
                    )
                );

                return;
            }

            imageStyle.width  = fitSizes.width;
            imageStyle.height = fitSizes.height;

            if (this.props.discourageDownloads) {
                imageStyle.backgroundImage = 'url(\'' + imageSrc + '\')';
                images.push(
                    React.createElement("div", {
                        className: imageClass, 
                        style: imageStyle, 
                        key: imageSrc
                    }, 
                        React.createElement("div", {className: "rlb-download-blocker"})
                    )
                );
            } else {
                images.push(
                    React.createElement("img", {
                        className: imageClass, 
                        style: imageStyle, 
                        src: imageSrc, 
                        key: imageSrc}
                    )
                );
            }
        }.bind(this);

        // Next Image (displayed on the right)
        addImage('nextSrc', 'rlb-image-next');
        // Main Image
        addImage('mainSrc', 'rlb-image-current');
        // Previous Image (displayed on the left)
        addImage('prevSrc', 'rlb-image-prev');

        var noop = function(){};

        return (
            React.createElement("div", {// Floating modal with closing animations
                className: "rlb-outer" + (this.state.isClosing ? ' rlb-closing' : ''), 
                style: { transition: 'opacity ' + String(this.props.animationDuration) + 'ms'}
            }, 

                React.createElement("div", {// Image holder
                    className: "rlb-inner"
                }, 
                    images
                ), 

                !this.props.prevSrc ? '' :
                    React.createElement("button", {// Move to previous image button
                        type: "button", 
                        className: "rlb-prev-button", 
                        onClick: !this.isAnimating() ? this.requestMovePrev : noop}// Ignore clicks during animation
                    ), 
                

                !this.props.nextSrc ? '' :
                    React.createElement("button", {// Move to next image button
                        type: "button", 
                        className: "rlb-next-button", 
                        onClick: !this.isAnimating() ? this.requestMoveNext : noop}// Ignore clicks during animation
                    ), 
                

                React.createElement("div", {// Lightbox toolbar
                    className: "rlb-toolbar"
                }, 
                    React.createElement("ul", {className: "rlb-toolbar-left"}, 
                        React.createElement("li", null, 
                            this.props.imageTitle
                        )
                    ), 
                    React.createElement("ul", {className: "rlb-toolbar-right"}, 
                        !this.props.toolbarButtons ? '' : this.props.toolbarButtons.map(function(button, i) {
                            return (React.createElement("li", {key: i}, button));
                        }), 

                        React.createElement("li", null, 
                            React.createElement("button", {// Lightbox close button
                                type: "button", 
                                className: "rlb-close", 
                                onClick: !this.isAnimating() ? this.requestClose : noop}// Ignore clicks during animation
                            )
                        )
                    )
                )
            )
        );
    }
});

},{}],2:[function(require,module,exports){
module.exports = require('./components/react-image-lightbox.jsx');

},{"./components/react-image-lightbox.jsx":1}]},{},[2])(2)
});
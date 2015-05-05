var fs = require('fs');
var spawn = require('child-process-promise').spawn;
var ip = require("ip");

var BIN = 'cordova';
var DEFAULTURL = 'index.html';

function runCordovaCmd(args, appDir) {
    var binary, arguments;

    if (/^win/.test(process.platform)) {
        binary = 'cmd.exe';
        arguments = ['/C', 'cordova ' + args.join(' ')];
    } else {
        arguments = args;
        binary = BIN;
    }

    return spawn(binary, arguments, {
        cwd: appDir
    }).progress(function(childProcess) {
        childProcess.stdout.on('data', function(data) {
            console.log('[spawn] stdout: ' + data.toString().trim());
        });
        childProcess.stderr.on('data', function(data) {
            console.error('[spawn] stderr: ' + data.toString().trim());
        });
    });
}

var CordovaApp = function(id, emitter, args, logger, config) {
    var self = this;
    self.settings = config.cordovaAppSettings;
    self.log = logger.create('launcher.cordova');
    self.name = self.platform + " on Cordova";
    self.defaultUrl = self.settings.defaultUrl ? self.settings.defaultUrl : DEFAULTURL;
    self.ip = self.settings.host ? self.settings.host : ip.address();

    console.log(self.settings);

    emitter.on('exit', function(done){
        console.log("!!!EXITING!!!");
        done();
    });

    var errorHandler = function(err) {
        self.log.error(err);
        emitter.emit('browser_process_failure', self);
    };

    var restoreDefaultUrl = function(appDir, newUrl) {
        fs.readFile(appDir + "/config.xml", function (read_err, read_data) {

            if (read_err) {
                errorHandler(read_err);
                return;
            }

            var toWrite = read_data.toString().replace(newUrl, self.defaultUrl);
            fs.writeFile(appDir + "/config.xml", toWrite, function (write_err) {
                if (write_err) {
                    errorHandler(write_err);
                    return;
                }
            });

        });
    };

    var errorHandlerWithRestore = function(err, appDir, newUrl) {
        errorHandler(err);
        restoreDefaultUrl(appDir, newUrl);
    };

    this.start = function(url) {

        self.log.debug("Starting at " + url);

        var appDir = self.settings.dir;
        var host = self.settings.ip;
        var platform = self.settings.platform;


        fs.readFile(appDir + "/config.xml", function (read_err, read_data) {

            if (read_err) {
                errorHandler(read_err);
                return;
            }

            var newUrl = url + "?id=" + id;
            newUrl = newUrl.replace('localhost', host);
            var toWrite = read_data.toString().replace(self.defaultUrl, newUrl);

            console.log("neue config:");
            console.log(toWrite);

            fs.writeFile(appDir + "/config.xml", toWrite, function (write_err) {

                if (write_err) {
                    errorHandlerWithRestore(write_err, appDir, newUrl);
                    return;
                }

                // restore config.xml after app startup is ready
                runCordovaCmd(['run', platform], appDir).then(function() {
                    restoreDefaultUrl(appDir, newUrl);
                }, errorHandlerWithRestore.bind(appDir, newUrl));

            });
        });


    };

    this.isCaptured = function() {
        return true;
    };

    this.kill = function(done) {
        self.log.debug("Killing");
        done();
    };

    this.toString = function() {
        return self.name;
    };

};

module.exports = {
    'launcher:CordovaApp': ['type', CordovaApp]
};

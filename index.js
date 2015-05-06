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
    var appDir, defaultUrl, host, platform, newUrl;
    self.settings = config.cordovaAppSettings;

    appDir = self.settings.dir;
    defaultUrl = self.settings.defaultUrl ? self.settings.defaultUrl : DEFAULTURL;
    host = self.settings.host ? self.settings.host : ip.address();
    platform = self.settings.platform;

    self.log = logger.create('launcher.cordova');
    self.name = self.platform + " on Cordova";

    console.log(self.settings);

    emitter.on('exit', function(done){
        console.log("!!!EXITING!!!");

        if(newUrl) {
            restoreDefaultUrl(appDir, newUrl, defaultUrl, done);
        } else {
            done();
        }

    });

    var errorHandler = function(err) {
        self.log.error(err);
        emitter.emit('browser_process_failure', self);
    };

    var restoreDefaultUrl = function(appDir, newUrl, defaultUrl, done) {

        fs.readFile(appDir + "/config.xml", function (read_err, read_data) {

            if (read_err) {
                errorHandler(read_err);
                return;
            }

            var toWrite = read_data.toString().replace(newUrl, defaultUrl);

            fs.writeFile(appDir + "/config.xml", toWrite, function (write_err) {
                if (write_err) {
                    errorHandler(write_err);

                    if(done) {
                        done();
                    }

                    return;
                }

                if(done) {
                    done();
                }
            });

        });
    };

    this.start = function(url) {

        self.log.debug("Starting at " + url);

        fs.readFile(appDir + "/config.xml", function (read_err, read_data) {

            var toWrite;

            if (read_err) {
                errorHandler(read_err);
                return;
            }

            newUrl = url + "?id=" + id;
            newUrl = newUrl.replace('localhost', host);

            toWrite = read_data.toString().replace(defaultUrl, newUrl);

            fs.writeFile(appDir + "/config.xml", toWrite, function (write_err) {

                if (write_err) {
                    errorHandler(write_err);
                    return;
                }

                // restore config.xml after app startup is ready
                runCordovaCmd(['run', platform, '--device'], appDir).fail(errorHandler);

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

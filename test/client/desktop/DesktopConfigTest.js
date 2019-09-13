// @flow
import o from "ospec"
import n from "../nodemocker"
import path from "path"

o.spec('desktop config handler test', function () {
	n.startGroup({group: __filename})

	const fsExtra = {
		existsSync: (path: string) => true,
		mkdirp: (path: string) => {},
		writeJSONSync: (path: string, object: any) => {},
		readJSONSync: (path: string) => {
			return {
				"heartbeatTimeoutInSeconds": 240,
				"defaultDownloadPath": "/mock-Downloads/",
				"enableAutoUpdate": true,
				"runAsTrayApp": true,
			}
		},
		writeJson: (path: string, obj: any, formatter: {spaces: number}, cb: ()=>void): void => cb(),
	}

	const electron = {
		app: {
			callbacks: {},
			once: function (ev: string, cb: ()=>void) {
				this.callbacks[ev] = cb
				return n.spyify(electron.app)
			},
			getPath: (path: string) => `/mock-${path}/`,
			getAppPath: () => path.resolve(__dirname, '../../../'),
		},
		dialog: {
			showMessageBox: () => {}
		}
	}

	const configMigrator = (f, conf, def) => conf

	const packageJson = {
		"tutao-config": {
			"pubKeyUrl": "https://raw.githubusercontent.com/tutao/tutanota/master/tutao-pub.pem",
			"pollingInterval": 10000,
			"preloadjs": "./src/desktop/preload.js",
			"desktophtml": "./desktop.html",
			"checkUpdateSignature": true,
			"appUserModelId": "de.tutao.tutanota-mock",
			"initialSseConnectTimeoutInSeconds": 60,
			"maxSseConnectTimeoutInSeconds": 2400,
			"defaultDesktopConfig": {
				"heartbeatTimeoutInSeconds": 30,
				"defaultDownloadPath": null,
				"enableAutoUpdate": true,
				"runAsTrayApp": true,
			}
		}
	}

	o("package.json & userConf", () => {
		const packageJsonMock = n.mock(path.resolve(__dirname, '../../../package.json'), packageJson).set()
		const fsExtraMock = n.mock('fs-extra', fsExtra).set()
		const electronMock = n.mock('electron', electron).set()
		const migratorMock = n.mock('./migrations/DesktopConfigMigrator', configMigrator).set()

		const {DesktopConfig} = n.subject('../../src/desktop/config/DesktopConfig')
		const conf = new DesktopConfig()

		o(migratorMock.callCount).equals(1)
		o(migratorMock.args.length).equals(3)

		// check if there is a user conf already (yes)
		o(fsExtraMock.existsSync.callCount).equals(1)
		o(fsExtraMock.existsSync.args[0]).equals("/mock-userData/conf.json")

		// read it
		o(fsExtraMock.readJSONSync.callCount).equals(1)
		o(fsExtraMock.readJSONSync.args[0]).equals("/mock-userData/conf.json")

		// make sure the userData folder exists
		o(fsExtraMock.mkdirp.callCount).equals(1)
		o(fsExtraMock.mkdirp.args[0]).equals("/mock-userData/")

		// write combined desktop config back
		o(fsExtraMock.writeJSONSync.callCount).equals(1)
		o(fsExtraMock.writeJSONSync.args[0]).equals("/mock-userData/conf.json")
		o(fsExtraMock.writeJSONSync.args[1]).deepEquals({
			"heartbeatTimeoutInSeconds": 240,
			"defaultDownloadPath": "/mock-Downloads/",
			"enableAutoUpdate": true,
			"runAsTrayApp": true,
		})
	})

	o("package.json & no userConf", () => {
		n.mock(path.resolve(__dirname, '../../../package.json'), packageJson).set()
		n.mock('electron', electron).set()
		const migratorMock = n.mock('./migrations/DesktopConfigMigrator', configMigrator).with(
			(f, conf, def) => def
		).set()
		const fsExtraMock = n.mock('fs-extra', fsExtra)
		                     .with({existsSync: () => false})
		                     .set()


		const {DesktopConfig} = n.subject('../../src/desktop/config/DesktopConfig.js')
		const conf = new DesktopConfig()

		// check if there is a user conf already (no)
		o(fsExtraMock.existsSync.callCount).equals(1)
		o(fsExtraMock.existsSync.args[0]).equals("/mock-userData/conf.json")

		// do not read it
		o(fsExtraMock.readJSONSync.callCount).equals(0)

		// make sure the userData folder exists
		o(fsExtraMock.mkdirp.callCount).equals(1)
		o(fsExtraMock.mkdirp.args[0]).equals("/mock-userData/")

		// write default desktop config
		o(fsExtraMock.writeJSONSync.callCount).equals(1)
		o(fsExtraMock.writeJSONSync.args[0]).equals("/mock-userData/conf.json")
		o(fsExtraMock.writeJSONSync.args[1]).deepEquals({
			"heartbeatTimeoutInSeconds": 30,
			"defaultDownloadPath": null,
			"enableAutoUpdate": true,
			"runAsTrayApp": true,
		})
	})

	o("package.json unavailable", done => {
		n.mock(path.resolve(__dirname, '../../../package.json'), undefined).set()
		n.mock('fs-extra', fsExtra).set()
		const electronMock = n.mock('electron', electron).set()
		const migratorMock = n.mock('./migrations/DesktopConfigMigrator', configMigrator).set()

		const {DesktopConfig} = n.subject('../../src/desktop/config/DesktopConfig.js')
		const conf = new DesktopConfig()

		// exit program
		o(electronMock.app.once.callCount).equals(1)
		electronMock.app.callbacks["ready"]()

		setTimeout(() => {
			o(electronMock.dialog.showMessageBox.callCount).equals(1)
			o(process.exit.callCount).equals(1)
			o(process.exit.args[0]).equals(1)
			done()
		}, 10)
	})

	o("get values from conf", () => {
		n.mock(path.resolve(__dirname, '../../../package.json'), packageJson).set()
		n.mock('fs-extra', fsExtra).set()
		n.mock('electron', electron).set()
		const migratorMock = n.mock('./migrations/DesktopConfigMigrator', configMigrator).with(
			(f, conf, def) => conf
		).set()

		const {DesktopConfig} = n.subject('../../src/desktop/config/DesktopConfig')
		const conf = new DesktopConfig()

		o(conf.getConst("pollingInterval")).equals(10000)
		o(conf.getVar("heartbeatTimeoutInSeconds")).equals(240)
		o(conf.getConst()).deepEquals({
			"pubKeyUrl": "https://raw.githubusercontent.com/tutao/tutanota/master/tutao-pub.pem",
			"pollingInterval": 10000,
			"preloadjs": "./src/desktop/preload.js",
			"desktophtml": "./desktop.html",
			"checkUpdateSignature": true,
			"appUserModelId": "de.tutao.tutanota-mock",
			"initialSseConnectTimeoutInSeconds": 60,
			"maxSseConnectTimeoutInSeconds": 2400,
			"defaultDesktopConfig": {
				"heartbeatTimeoutInSeconds": 30,
				"defaultDownloadPath": null,
				"enableAutoUpdate": true,
				"runAsTrayApp": true,
			}
		})
		o(conf.getVar()).deepEquals({
			"heartbeatTimeoutInSeconds": 240,
			"defaultDownloadPath": "/mock-Downloads/",
			"enableAutoUpdate": true,
			"runAsTrayApp": true,
		})
	})

	o("change single value and update conf file", (done) => {
		const packageJsonMock = n.mock(path.resolve(__dirname, '../../../package.json'), packageJson).set()
		const fsExtraMock = n.mock('fs-extra', fsExtra).set()
		const electronMock = n.mock('electron', electron).set()
		const migratorMock = n.mock('./migrations/DesktopConfigMigrator', configMigrator).set()

		const {DesktopConfig} = n.subject('../../src/desktop/config/DesktopConfig')
		const conf = new DesktopConfig()

		conf.setVar("enableAutoUpdate", false).then(() => {
			const expectedConfig = {
				"heartbeatTimeoutInSeconds": 240,
				"defaultDownloadPath": "/mock-Downloads/",
				"enableAutoUpdate": false,
				"runAsTrayApp": true,
			}
			// value was changed in memory
			o(conf._desktopConfig).deepEquals(expectedConfig)

			//config was written to disk
			o(fsExtraMock.writeJson.callCount).equals(1)
			o(fsExtraMock.writeJson.args[0]).equals("/mock-userData/conf.json")
			o(fsExtraMock.writeJson.args[1]).deepEquals(expectedConfig)
			done()
		})
	})

	o("update entire conf", (done) => {
		const packageJsonMock = n.mock(path.resolve(__dirname, '../../../package.json'), packageJson).set()
		const fsExtraMock = n.mock('fs-extra', fsExtra).set()
		const electronMock = n.mock('electron', electron).set()
		const migratorMock = n.mock('./migrations/DesktopConfigMigrator', configMigrator).set()

		const {DesktopConfig} = n.subject('../../src/desktop/config/DesktopConfig.js')
		const conf = new DesktopConfig()

		const expectedConfig = {
			"heartbeatTimeoutInSeconds": 30,
			"defaultDownloadPath": "helloWorld",
			"enableAutoUpdate": false,
			"runAsTrayApp": false,
		}

		conf.setVar("any", expectedConfig).then(() => {
			// value was changed in memory
			o(conf._desktopConfig).deepEquals(expectedConfig)

			//config was written to disk
			o(fsExtraMock.writeJson.callCount).equals(1)
			o(fsExtraMock.writeJson.args[0]).equals("/mock-userData/conf.json")
			o(fsExtraMock.writeJson.args[1]).deepEquals(expectedConfig)
			done()
		})
	})

	o("set listener and change value", (done) => {
		n.mock(path.resolve(__dirname, '../../../package.json'), packageJson).set()
		n.mock('fs-extra', fsExtra).set()
		n.mock('electron', electron).set()
		const migratorMock = n.mock('./migrations/DesktopConfigMigrator', configMigrator).set()

		const {DesktopConfig} = n.subject('../../src/desktop/config/DesktopConfig')
		const conf = new DesktopConfig()

		const downloadPathListener = o.spy(v => {})
		const heartbeatListener = o.spy(v => {})
		const anyListener = o.spy(v => {})

		conf.on("defaultDownloadPath", downloadPathListener)
		conf.on("heartbeatTimeoutInSeconds", heartbeatListener)
		conf.on("any", anyListener)

		conf.setVar("defaultDownloadPath", "/mock-downloads/").then(() => {
			o(downloadPathListener.callCount).equals(1)
			o(downloadPathListener.args[0]).equals("/mock-downloads/")

			// this key was not changed
			o(heartbeatListener.callCount).equals(0)

			//this should be called for any changes
			o(anyListener.callCount).equals(1)
			o(anyListener.args[0]).deepEquals({
				"heartbeatTimeoutInSeconds": 240,
				"defaultDownloadPath": "/mock-downloads/",
				"enableAutoUpdate": true,
				"runAsTrayApp": true,
			})
		}).then(() => conf.setVar("any", {
				"heartbeatTimeoutInSeconds": 42,
				"defaultDownloadPath": "/mock-downloads/",
				"enableAutoUpdate": true,
				"runAsTrayApp": true,
			})
		).then(() => {
			o(anyListener.callCount).equals(2)
			o(heartbeatListener.callCount).equals(1)
			o(heartbeatListener.args[0]).equals(42)
			o(downloadPathListener.callCount).equals(1)
			done()
		})
	})

	o("removeListener splices out the right listener", done => {
		n.mock(path.resolve(__dirname, '../../../package.json'), packageJson).set()
		n.mock('fs-extra', fsExtra).set()
		n.mock('electron', electron).set()
		const migratorMock = n.mock('./migrations/DesktopConfigMigrator', configMigrator).set()

		const {DesktopConfig} = n.subject('../../src/desktop/config/DesktopConfig')
		const conf = new DesktopConfig()

		const listener1 = o.spy(v => {})
		const listener2 = o.spy(v => {})
		const listener3 = o.spy(v => {})
		const listener4 = o.spy(v => {})

		conf.on("defaultDownloadPath", listener1)
		conf.on("defaultDownloadPath", listener2)
		conf.on("defaultDownloadPath", listener3)
		conf.on("defaultDownloadPath", listener4)

		conf.removeListener("defaultDownloadPath", listener3)

		conf.setVar("defaultDownloadPath", "/mock-downloads/").then(() => {
			o(listener1.callCount).equals(1)
			o(listener2.callCount).equals(1)
			o(listener3.callCount).equals(0)
			o(listener4.callCount).equals(1)
			done()
		})
	})

	o("set/remove listeners and change value", done => {
		n.mock(path.resolve(__dirname, '../../../package.json'), packageJson).set()
		n.mock('fs-extra', fsExtra).set()
		n.mock('electron', electron).set()
		const migratorMock = n.mock('./migrations/DesktopConfigMigrator', configMigrator).set()

		const {DesktopConfig} = n.subject('../../src/desktop/config/DesktopConfig')
		const conf = new DesktopConfig()

		const listener1 = o.spy(v => {})
		const listener2 = o.spy(v => {})
		const listener3 = o.spy(v => {})

		conf.on("defaultDownloadPath", listener1)
		conf.removeListener("defaultDownloadPath", listener1)

		conf.on("defaultDownloadPath", listener2)
		conf.on("defaultDownloadPath", listener3)

		conf.setVar("defaultDownloadPath", "/mock-downloads/").then(() => {
			o(listener1.callCount).equals(0)

			o(listener2.callCount).equals(1)
			o(listener2.args[0]).equals("/mock-downloads/")
			o(listener3.callCount).equals(1)
			o(listener3.args[0]).equals("/mock-downloads/")
			done()
		})
	})

	o("removeAllListeners removes all listeners", done => {
		n.mock(path.resolve(__dirname, '../../../package.json'), packageJson).set()
		n.mock('fs-extra', fsExtra).set()
		n.mock('electron', electron).set()
		const migratorMock = n.mock('./migrations/DesktopConfigMigrator', configMigrator).set()

		const {DesktopConfig} = n.subject('../../src/desktop/config/DesktopConfig.js')
		const conf = new DesktopConfig()

		const listener1 = o.spy(v => {})
		const listener2 = o.spy(v => {})
		const listener3 = o.spy(v => {})

		conf.on("defaultDownloadPath", listener1)
		conf.on("heartbeatTimeoutInSeconds", listener2)
		conf.on("defaultDownloadPath", listener3)
		conf.removeAllListeners()

		conf.setVar("defaultDownloadPath", "/mock-downloads/").then(() => {
			o(listener1.callCount).equals(0)
			o(listener2.callCount).equals(0)
			o(listener3.callCount).equals(0)
			done()
		})
	})
})

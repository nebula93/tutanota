pipeline {
    environment {
        NODE_PATH = "/opt/node-v10.11.0-linux-x64/bin"
    }
	options {
		preserveStashes()
	}

	parameters {
        booleanParam(name: 'RELEASE', defaultValue: false, description: '')
    }

    agent {
        label 'master'
    }

    stages {
        stage('Build Webapp') {
        	environment {
        		PATH="${env.PATH}:${env.NODE_PATH}"
        	}
            agent {
                label 'linux'
            }
            steps {
            	sh 'npm ci'
				sh 'node dist release'
				stash includes: 'build/dist/**', excludes:'**/index.html, **/app.html, **/desktop.html, **/index.js, **/app.js, **/desktop.js', name: 'web_base'
				stash includes: '**/dist/index.html, **/dist/index.js, **/dist/app.html, **/dist/app.js', name: 'web_add'
				stash includes: 'build/bundles.json', name: 'bundles'
            }
        }

        stage('Build Desktop clients'){
			when {
				expression { params.RELEASE }
			}
            parallel {
                stage('desktop-win') {
					environment {
        		        PATH="${env.PATH}:${env.NODE_PATH}"
					}
                    agent {
                        label 'win'
                    }
                    steps {
            			sh 'npm ci'
						sh 'rm -rf ./build/*'
						unstash 'web_base'
						unstash 'bundles'
						withCredentials([string(credentialsId: 'HSM_USER_PIN', variable: 'PW')]){
						    sh '''
						    export JENKINS=TRUE;
						    export HSM_USER_PIN=${PW};
						    export WIN_CSC_FILE="/opt/etc/codesign.crt";
						    node dist -ew '''
						}
						dir('build') {
							stash includes: 'desktop-test/*', name:'win_installer_test'
							stash includes: 'desktop/*', name:'win_installer'
						}
                	}
                }

                stage('desktop-mac') {
                    agent {
                        label 'mac'
                    }
                    steps {
						sh 'npm ci'
						sh 'rm -rf ./build/*'
						unstash 'web_base'
						unstash 'bundles'
					   	withCredentials([usernamePassword(credentialsId: 'APP_NOTARIZE_CREDS', usernameVariable: 'APPLEIDVAR', passwordVariable: 'APPLEIDPASSVAR')]){
							sh '''
								export JENKINS=TRUE;
								export APPLEID=${APPLEIDVAR};
								export APPLEIDPASS=${APPLEIDPASSVAR};
								node dist -em '''
						}
						dir('build') {
							stash includes: 'desktop-test/*', name:'mac_installer_test'
                            stash includes: 'desktop/*', name:'mac_installer'
						}
                    }
                }


                stage('desktop-linux'){
                    agent {
                        label 'linux'
                    }
					environment {
						PATH="${env.PATH}:${env.NODE_PATH}"
					}
                    steps {
						sh 'npm ci'
						sh 'rm -rf ./build/*'
						unstash 'web_base'
						unstash 'bundles'
						sh 'node dist -el'
						dir('build') {
							stash includes: 'desktop-test/*', name:'linux_installer_test'
							stash includes: 'desktop/*', name:'linux_installer'
						}
                    }
                }
            }
        }

        stage('Build deb and publish') {
            when {
            	expression { params.RELEASE }
            }
            agent {
                label 'linux'
            }
			environment {
				PATH="${env.PATH}:${env.NODE_PATH}"
			}
            steps {
            	sh 'npm ci'
				sh 'rm -rf ./build/*'
				unstash 'web_base'
				unstash 'web_add'
				unstash 'bundles'
				dir('build'){
					unstash 'linux_installer'
					unstash 'mac_installer'
					unstash 'win_installer'
					unstash 'linux_installer_test'
                    unstash 'mac_installer_test'
                    unstash 'win_installer_test'
				}
				withCredentials([string(credentialsId: 'HSM_USER_PIN', variable: 'PW')]){
					sh '''
					export HSM_USER_PIN=${PW};
					node dist -edp release '''
				}
            }
        }
    }
}

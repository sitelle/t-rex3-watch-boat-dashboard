.PHONY: launch-signalk sim-deploy device-deploy build ensure-simulator

SIGNALK_CMD := signalk-server
BUILD_CMD := zeus build
DEPLOY_CMD := zeus preview
SIMULATOR_PROCESS := /Applications/simulator.app/Contents/MacOS/simulator
SIMULATOR_LAUNCH := cd /Applications/simulator.app/Contents/MacOS && sudo -s ./simulator

launch-signalk:
	@echo "[launch-signalk] Demarrage du serveur Signal K..."
	@$(SIGNALK_CMD)

build:
	@echo "[build] Build du projet..."
	@$(BUILD_CMD)

ensure-simulator:
	@if pgrep -f "$(SIMULATOR_PROCESS)" >/dev/null; then \
		echo "[sim-deploy] Simulateur deja lance, on le conserve."; \
	else \
		echo "[sim-deploy] Simulateur non detecte, lancement avec droits root..."; \
		nohup sh -c '$(SIMULATOR_LAUNCH)' >/tmp/zepp-simulator.log 2>&1 &; \
		sleep 2; \
	fi

sim-deploy: build ensure-simulator
	@echo "[sim-deploy] Deploiement vers le simulateur..."
	@$(DEPLOY_CMD)

device-deploy: build
	@echo "[device-deploy] Deploiement vers la montre physique..."
	@$(DEPLOY_CMD)

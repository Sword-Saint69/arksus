# NöbetSu — owner: Gümüş (Rol B). Windows: install make (e.g. `winget install ezwinports.make`) or run the commands below by hand.
PYTHON ?= python

.PHONY: test test-py test-web mock data web

test: test-py test-web

test-py:
	cd engine && $(PYTHON) -m pytest -q

# Web tests run once İsmail's web/ skeleton (package.json with vitest) exists.
test-web:
	@if [ -f web/package.json ]; then cd web && npm test -- --run; else echo "web/package.json yok: web testleri atlandı"; fi

mock:
	cd engine && $(PYTHON) -m nobetsu.build --mock --out ../web/public/data

data:
	cd engine && $(PYTHON) -m nobetsu.build --out ../web/public/data

web:
	cd web && npm ci && npm run build

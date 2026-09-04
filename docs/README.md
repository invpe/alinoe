# Microgrid WWW

A static, read-only single pager for showing Microgrid experiments. The browser
never connects to port 1911 and the compute runtime never writes into `WWW/`.

Runtime producers own their local snapshots:

```text
Server/grid.json
Projects/*/project.json
```

Each project has exactly **one public artifact**: its `project.json`. The common
fields describe title/status/progress/best/metrics. An optional `visualization`
object contains both project-owned JavaScript and its visualization data.
There is no separate trajectory/image/chart JSON contract imposed by WWW.

`Tools/publish_www.py` discovers those project files and publishes:

```text
WWW/data/grid.json
WWW/data/projects/index.json
WWW/data/projects/<id>.json
```

`index.json` contains the project list and running/completed counts. Running
projects are ordered first; completed projects remain available as Microgrid
history. The page exposes All / Running / Completed filters plus horizontal
swipe/arrow navigation.

## Project JSON contract

The generic portion is intentionally small:

```json
{
  "schema": 1,
  "id": "example",
  "title": "Example experiment",
  "description": "What the grid is trying to discover.",
  "status": "running",
  "updated_at_unix": 0,
  "started_at_unix": 0,
  "completed_at_unix": null,
  "progress": {
    "current": 120,
    "total": 1000,
    "unit": "candidates",
    "throughput": 4.2,
    "throughput_unit": "candidates/s",
    "eta_seconds": 210
  },
  "best": {
    "label": "Best result",
    "value": 12.34,
    "unit": "units",
    "decimals": 2,
    "status": "VALID"
  },
  "metrics": [
    {"label": "Some metric", "value": "42"}
  ]
}
```

A project that has something useful to show may add:

```json
{
  "visualization": {
    "code": "root.textContent = data.message;",
    "data": {"message": "hello"}
  }
}
```

The code is owned by the project and runs in a sandboxed iframe with no network
access and no access to the parent page. Its JavaScript body receives exactly
three variables: `root`, `project`, and `data`. If `visualization` is absent,
WWW simply renders the project details without a visualization panel.

PaperPlane follows this model: its project-local `visualization.js` is embedded
into `project.json` together with the current best trajectory whenever a new
best candidate is published. WWW itself contains no PaperPlane-specific code.

## Local live preview

From the Microgrid root:

```bash
python3 Tools/publish_www.py --watch 2
```

In another terminal:

```bash
cd WWW
python3 serve.py
```

Open `http://127.0.0.1:8080/`.

## Public Git repository

Keep a checkout of the public static-site repository on the machine that runs
Microgrid, then periodically run:

```bash
python3 Tools/publish_www.py \
    --repo /srv/microgrid-public \
    --push
```

A minimal cron example (once per minute):

```cron
* * * * * cd /srv/microgrid && /usr/bin/python3 Tools/publish_www.py --repo /srv/microgrid-public --push >> /tmp/microgrid-publish.log 2>&1
```

The publisher commits only when `data/` changed. It automatically discovers
`Projects/*/project.json`, so adding a future project does not require changes
to the publisher or WWW.

## Data source

`config.json` controls the website data source:

```json
{
  "data_base_url": "data",
  "grid_poll_ms": 5000,
  "projects_poll_ms": 10000,
  "github_url": "",
  "stale_after_seconds": 180
}
```

For GitHub Pages, leave `data_base_url` as `data` if the data is in the same
site repository. If the page and data live separately, set it to the public
data directory URL. No server or project configuration changes are required.

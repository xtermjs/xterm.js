"""
run.py — one experiment for slim-forge xterm.js mission.

invoked by the agent each cycle:
    python run.py
    python run.py --record --description "tried X"

pipeline: install -> build (tsc + esbuild) -> test-unit -> bench -> record

bench script prints one float on stdout last line (weighted MB/s).
the harness enforces ops > best_so_far * 1.05 before labeling keep.

NEVER edit this file.
"""

from __future__ import annotations

import argparse
import csv
import subprocess
import sys
import time
import tomllib
from pathlib import Path

HERE = Path(__file__).parent.resolve()
THRESHOLD_MULT = 1.05


def sh(cmd: str, timeout: int = 900) -> subprocess.CompletedProcess:
    return subprocess.run(
        cmd, shell=True, cwd=HERE, text=True, capture_output=True,
        timeout=timeout, check=False,
    )


def load_spec() -> dict:
    p = HERE / ".slimforge.toml"
    if not p.exists():
        print("error: .slimforge.toml missing. did you run prepare.py?", file=sys.stderr)
        sys.exit(2)
    with open(p, "rb") as f:
        return tomllib.load(f)


def install(spec: dict) -> tuple[bool, float]:
    t0 = time.time()
    r = sh(spec["install_cmd"], timeout=600)
    dt = time.time() - t0
    if r.returncode != 0:
        print("[install stderr tail]", file=sys.stderr)
        print(r.stderr[-2000:], file=sys.stderr)
        return False, dt
    return True, dt


def build(spec: dict) -> tuple[bool, float]:
    cmd = spec.get("build_cmd", "").strip()
    if not cmd:
        return True, 0.0
    t0 = time.time()
    r = sh(cmd, timeout=600)
    dt = time.time() - t0
    if r.returncode != 0:
        print("[build stderr tail]", file=sys.stderr)
        print(r.stderr[-3000:], file=sys.stderr)
        print("[build stdout tail]", file=sys.stderr)
        print(r.stdout[-3000:], file=sys.stderr)
        return False, dt
    return True, dt


def run_tests(spec: dict) -> tuple[bool, float]:
    t0 = time.time()
    r = sh(spec["test_cmd"], timeout=600)
    dt = time.time() - t0
    if r.returncode != 0:
        print("[test stderr tail]", file=sys.stderr)
        print(r.stderr[-3000:], file=sys.stderr)
        print("[test stdout tail]", file=sys.stderr)
        print(r.stdout[-3000:], file=sys.stderr)
    return r.returncode == 0, dt


def run_bench(spec: dict) -> tuple[float, str]:
    cmd = spec.get("bench_cmd", "").strip()
    if not cmd:
        return -1.0, ""
    r = sh(cmd, timeout=300)
    tail = (r.stdout + ("\n[stderr]\n" + r.stderr if r.stderr else ""))[-3000:]
    if r.returncode != 0:
        print("[bench failed, tail]", file=sys.stderr)
        print(tail, file=sys.stderr)
        return -1.0, tail
    try:
        return float(r.stdout.strip().splitlines()[-1]), tail
    except (ValueError, IndexError):
        print("[bench output unparseable, tail]", file=sys.stderr)
        print(tail, file=sys.stderr)
        return -1.0, tail


def compute_best_so_far() -> float:
    tsv = HERE / "results.tsv"
    if not tsv.exists():
        return 0.0
    best = 0.0
    with open(tsv) as f:
        for row in csv.DictReader(f, delimiter="\t"):
            if row.get("status") == "keep" and row.get("tests_pass") == "1":
                try:
                    v = float(row["mbps"])
                    if v > best:
                        best = v
                except (ValueError, KeyError):
                    pass
    return best


def git_sha() -> str:
    r = sh("git rev-parse --short HEAD", timeout=10)
    return r.stdout.strip() or "0000000"


def append_results_row(
    sha: str, mbps: float, tests_pass: bool, build_ok: bool,
    status: str, description: str,
) -> None:
    desc = description.replace("\t", " ").replace("\n", " ").strip()
    tsv = HERE / "results.tsv"
    if not tsv.exists():
        tsv.write_text("commit\tmbps\ttests_pass\tbuild_ok\tstatus\tdescription\n")
    with open(tsv, "a") as f:
        f.write(f"{sha}\t{mbps:.1f}\t{int(tests_pass)}\t{int(build_ok)}\t{status}\t{desc}\n")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--record", action="store_true")
    ap.add_argument("--description", default="")
    ap.add_argument("--status", default=None)
    args = ap.parse_args()

    spec = load_spec()

    install_ok, install_secs = install(spec)
    if not install_ok:
        print("---")
        print("install:         FAILED")
        if args.record:
            append_results_row(git_sha(), -1.0, False, False,
                               args.status or "crash",
                               args.description or "install failed")
        return 1

    build_ok, build_secs = build(spec)
    if not build_ok:
        print("---")
        print("build:           FAILED")
        if args.record:
            append_results_row(git_sha(), -1.0, False, False,
                               args.status or "discard",
                               args.description or "build failed")
        return 1

    tests_pass, test_secs = run_tests(spec)
    primary_mbps, bench_tail = run_bench(spec)

    print("---")
    print(f"mbps:            {primary_mbps:.1f}")
    print(f"tests_passed:    {int(tests_pass)}")
    print(f"build_ok:        {int(build_ok)}")
    print(f"install_seconds: {install_secs:.1f}")
    print(f"build_seconds:   {build_secs:.1f}")
    print(f"test_seconds:    {test_secs:.1f}")

    if args.record:
        status = args.status
        if status is None:
            best = compute_best_so_far()
            threshold = best * THRESHOLD_MULT
            if not tests_pass:
                status = "discard"
            elif primary_mbps < threshold:
                status = "discard"
            else:
                status = "keep"
            print(f"best_so_far:     {best:.1f}")
            print(f"threshold:       {threshold:.1f}  (best_so_far * {THRESHOLD_MULT})")
            print(f"auto-status:     {status}")
        append_results_row(git_sha(), primary_mbps, tests_pass, build_ok,
                           status, args.description)

    return 0 if tests_pass else 1


if __name__ == "__main__":
    sys.exit(main())

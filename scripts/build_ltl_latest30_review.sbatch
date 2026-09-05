#!/usr/bin/env bash
#SBATCH --job-name=ltl30-review-site
#SBATCH --nodes=1
#SBATCH --ntasks=1
#SBATCH --mem=4G
#SBATCH --time=04:00:00
#SBATCH --partition=notchpeak-shared-short
#SBATCH --qos=notchpeak-shared-short
#SBATCH --account=notchpeak-shared-short
#SBATCH --output=/scratch/general/vast/u6076945/generator-runs/ltl-latest30-review-site-20260904/logs/build-%j.out
#SBATCH --error=/scratch/general/vast/u6076945/generator-runs/ltl-latest30-review-site-20260904/logs/build-%j.err

set -euo pipefail

repo=/uufs/chpc.utah.edu/common/home/u6076945/Oscar-Ge.github.io-ltl-latest30-review
run_root=/scratch/general/vast/u6076945/generator-runs/ltl-latest30-review-site-20260904
stage="$run_root/stage"
site="$repo/demos/ltl-ui-latest30-navigation-error-review"

mkdir -p "$run_root/logs" "$stage"
python3 "$repo/scripts/build_ltl_latest30_review.py" \
  --evidence /uufs/chpc.utah.edu/common/home/u6076945/ltl-ui-latest30-new-property-blv-review-evidence-2026-09-04.json \
  --canonical-review /scratch/general/vast/u6076945/generator-runs/ltl-selected31-latest30-reproduce-latest23-20260904-r3/selected31-latest30-reproduced-new-property-error-review.json \
  --output "$stage"

rsync -a "$stage/cases.js" "$stage/dataset-summary.json" "$stage/images" "$site/"
python3 -m py_compile "$repo/scripts/build_ltl_latest30_review.py"
node --check "$site/app.mjs"
node --check "$site/model.mjs"
node --test "$repo/tests/ltl_latest30_review_model.test.mjs"

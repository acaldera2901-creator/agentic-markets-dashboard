"""Regression tests: real shell helpers, mocked external Vercel only."""
import os, pathlib, subprocess, tempfile, unittest
LIB=pathlib.Path(__file__).resolve().parents[1]/'lib.sh'
class Gates(unittest.TestCase):
 def run_shell(self, script):
  with tempfile.TemporaryDirectory() as tmp:
   env=dict(os.environ, DEPLOY_LOG_DIR=tmp, DEPLOY_RUN_ID='run-a', DEPLOY_APPROVED_SHA='a'*40)
   return subprocess.run(['bash','-c',f'source "{LIB}"\n'+script],env=env,text=True,capture_output=True)
 def test_remote_value_ignores_local_environment(self):
  r=self.run_shell('''du_vercel_project_id() { echo prj_TEST; }
AFFILIATE_PAYOUTS=on
du_vercel() { case "$2" in /v10/*) echo '{"envs":[{"key":"AFFILIATE_PAYOUTS","id":"flag","type":"plain","target":["production"]}]}' ;; /v1/*) echo '{"key":"AFFILIATE_PAYOUTS","type":"plain","value":"off"}' ;; *) return 1;; esac; }
value=$(du_vercel_env_value AFFILIATE_PAYOUTS)
[ "$value" = off ]''');self.assertEqual(r.returncode,0,r.stdout+r.stderr)
 def test_sensitive_flag_is_not_empty_or_off(self):
  r=self.run_shell('''du_vercel_project_id() { echo prj_TEST; }
du_vercel() { echo '{"envs":[{"key":"AFFILIATE_PAYOUTS","id":"flag","type":"sensitive","target":["production"]}]}'; }
du_vercel_env_value AFFILIATE_PAYOUTS''');self.assertNotEqual(r.returncode,0)
 def test_preview_flag_does_not_count_as_production(self):
  r=self.run_shell('''du_vercel_project_id() { echo prj_TEST; }
du_vercel() { echo '{"envs":[{"key":"AFFILIATE_ACCOUNTING_READY","id":"flag","type":"sensitive","target":["preview"]}]}'; }
value=$(du_vercel_env_value AFFILIATE_ACCOUNTING_READY)
[ -z "$value" ]''');self.assertEqual(r.returncode,0,r.stdout+r.stderr)
 def test_cli_denied_is_not_a_missing_flag(self):
  r=self.run_shell('du_vercel() { return 1; }; du_vercel_env_value AFFILIATE_PAYOUTS');self.assertNotEqual(r.returncode,0)
 def test_malformed_output_is_rejected(self):
  r=self.run_shell("du_vercel() { echo 'unexpected response'; }; du_vercel_env_value AFFILIATE_PAYOUTS");self.assertNotEqual(r.returncode,0)
 def test_marker_not_reusable_for_another_run(self):
  r=self.run_shell('du_mark passo5 abc; DEPLOY_RUN_ID=run-b; du_has_mark passo5');self.assertNotEqual(r.returncode,0)
 def test_marker_not_reusable_for_another_revision(self):
  r=self.run_shell('du_mark passo5 abc; DEPLOY_APPROVED_SHA='+('b'*40)+'; du_has_mark passo5');self.assertNotEqual(r.returncode,0)
 def test_marker_same_context_is_valid(self):
  r=self.run_shell('du_mark passo5 abc; du_has_mark passo5');self.assertEqual(r.returncode,0,r.stdout+r.stderr)
 def test_failed_names_read_not_empty_success(self):
  r=self.run_shell('du_vercel() { return 1; }; du_vercel_env_names');self.assertNotEqual(r.returncode,0)
 def test_deployment_matches_only_exact_sha_and_project(self):
  setup='''VERCEL_CWD="$LOG_DIR"; mkdir -p "$VERCEL_CWD/.vercel"
echo '{"projectId":"prj_TEST"}' > "$VERCEL_CWD/.vercel/project.json"
du_vercel() { if [ "$1" = inspect ]; then echo '{"id":"dpl_TEST","target":"production","readyState":"READY"}'; else printf '{"id":"dpl_TEST","projectId":"%s","target":"production","readyState":"READY","gitSource":{"sha":"%s"}}' "$PROJECT" "$REV"; fi; }
PROJECT=prj_TEST; REV="$DEPLOY_APPROVED_SHA"
'''
  self.assertEqual(self.run_shell(setup+'du_production_matches "$REV"').returncode,0)
  self.assertNotEqual(self.run_shell(setup+'PROJECT=prj_OTHER; du_production_matches "$REV"').returncode,0)
  self.assertNotEqual(self.run_shell(setup+'du_production_matches '+('b'*40)).returncode,0)
if __name__=='__main__':unittest.main()

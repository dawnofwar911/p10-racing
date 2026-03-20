// Run with: npx tsx lib/supabase/sync_github_issues.ts
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env variables manually for Node script
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

// If running in GitHub Actions, use secrets
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Must use service role to bypass RLS
const githubToken = process.env.GITHUB_TOKEN!;
const repoFullName = process.env.GITHUB_REPOSITORY!; // e.g. "user/p10-racing"

interface GitHubIssueResponse {
  number: number;
}

const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

async function sync() {
  console.log('🔍 Checking for new bug reports...');

  // 1. Fetch bug reports without a github_issue_number
  const { data: bugs, error: fetchError } = await supabase
    .from('bug_reports')
    .select('*')
    .is('github_issue_number', null);

  if (fetchError) {
    console.error('❌ Error fetching bugs:', fetchError);
    process.exit(1);
  }

  if (!bugs || bugs.length === 0) {
    console.log('✅ No new bug reports to sync.');
    return;
  }

  console.log(`🚀 Found ${bugs.length} new bug reports. Syncing to GitHub...`);

  for (const bug of bugs) {
    const deviceInfo = bug.device_info || {};
    const storage = deviceInfo.storage_summary || {};
    
    const body = `
### Bug Description
${bug.description}

### Device Info
- **Platform:** ${deviceInfo.platform || 'unknown'}
- **App Version:** v${deviceInfo.app_version || 'unknown'}
- **OS Version:** ${deviceInfo.os_version || 'unknown'}
- **Device:** ${(deviceInfo.manufacturer ? deviceInfo.manufacturer + ' ' : '') + (deviceInfo.model || 'unknown')}`.trim() + ` ${deviceInfo.is_virtual ? '(Emulator)' : ''}
- **Screen:** ${deviceInfo.screen || 'unknown'}
- **Network:** ${deviceInfo.network_status || 'unknown'} (${deviceInfo.connection_type || 'unknown'})
- **Battery:** ${typeof deviceInfo.battery_level === 'number' ? Math.round(deviceInfo.battery_level * 100) + '%' : 'unknown'} ${deviceInfo.is_charging ? '⚡' : ''}
- **User Agent:** ${deviceInfo.user_agent || 'unknown'}
- **URL:** ${deviceInfo.url || 'unknown'}

### Storage Diagnostics
- **Local Keys:** ${storage.total_keys || 0}
- **Session:** ${storage.has_session ? '✅ Active' : '❌ None'}
- **Predictions:** ${storage.has_predictions ? '✅ Cached' : '❌ None'}
- **Drivers:** ${storage.has_drivers ? '✅ Cached' : '❌ None'}
${storage.all_keys ? `- **All Keys:** \`${storage.all_keys.join(', ')}\`` : ''}

${Array.isArray(deviceInfo.recent_errors) && deviceInfo.recent_errors.length > 0 ? `
### Recent Console Errors
\`\`\`
${deviceInfo.recent_errors.join('\n')}
\`\`\`
` : ''}

### Attachments
${bug.image_url ? `![Screenshot](${bug.image_url})` : '*No screenshot provided*'}

---
*Automatically synced from P10 Racing In-App Bug Reporter*
`;

    try {
      const response = await fetch(`https://api.github.com/repos/${repoFullName}/issues`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Supabase-Sync-Script',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: `[App Bug]: ${bug.title}`,
          body: body,
          labels: ['bug', 'triage']
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`GitHub API Error: ${JSON.stringify(errorData)}`);
      }

      const issueData = await response.json() as GitHubIssueResponse;
      const issueNumber = issueData.number;

      // 2. Update bug report in Supabase with issue number
      const { error: updateError } = await supabase
        .from('bug_reports')
        .update({ github_issue_number: issueNumber, status: 'synced' })
        .eq('id', bug.id);

      if (updateError) {
        console.error(`❌ Created issue #${issueNumber} but failed to update Supabase:`, updateError);
      } else {
        console.log(`✅ Synced bug "${bug.title}" to GitHub Issue #${issueNumber}`);
      }
    } catch (err) {
      console.error(`❌ Failed to sync bug "${bug.title}":`, err);
    }
  }
}

sync();

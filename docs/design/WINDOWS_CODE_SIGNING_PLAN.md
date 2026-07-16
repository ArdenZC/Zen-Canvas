# Zen Canvas Windows Code Signing Plan

## Current gate

The Stage 10 release executable and NSIS installer are both `NotSigned`. This is acceptable for internal RC validation only. It does not pass the public Windows installation gate and must not be presented as a signed release.

## Recommended production approach

1. Use a publicly trusted Windows code-signing identity. Microsoft currently documents Azure Artifact Signing and trusted CA certificates as non-Store signing options: <https://learn.microsoft.com/windows/apps/package-and-deploy/code-signing-options>.
2. Prefer an RSA certificate/profile compatible with Smart App Control. Microsoft documents RSA as the supported algorithm for signed applications evaluated by Smart App Control: <https://learn.microsoft.com/windows/apps/develop/smart-app-control/code-signing-for-smart-app-control>.
3. Keep the private key outside the repository. Use a hardware-backed key, managed signing service, or protected CI identity with least privilege and audited access. Never place a PFX, password, token, or certificate private key in source control or build logs.
4. Sign the application executable before NSIS packaging, then sign the final installer after packaging. Timestamp every signature with a trusted RFC 3161 timestamp service so an otherwise valid signature remains verifiable after certificate expiry.
5. Treat signing as a release-only CI stage after all tests and release builds pass. Do not sign pull-request artifacts from untrusted forks.

## OV, EV, reputation, and SmartScreen

OV and EV certificates establish publisher identity; they do not justify claiming that every new binary will immediately avoid SmartScreen warnings. Microsoft Defender SmartScreen also considers reputation signals, and a newly signed or newly hashed build can still be warned about. Microsoft describes application reputation here: <https://learn.microsoft.com/windows/apps/package-and-deploy/smartscreen-reputation> and SmartScreen behavior here: <https://learn.microsoft.com/windows/security/operating-system-security/virus-and-threat-protection/microsoft-defender-smartscreen/>.

Do not use a self-signed certificate as evidence that the public signing gate passed. Microsoft documents test signing separately for development validation: <https://learn.microsoft.com/windows/apps/develop/smart-app-control/test-your-app-with-smart-app-control>.

## CI signing order

1. Check out an immutable release commit.
2. Install locked Node and Rust dependencies.
3. Run the complete frontend, Rust, performance, audit, and verification matrix.
4. Build the unsigned release executable.
5. Sign and timestamp `zen-canvas.exe`.
6. Verify that executable signature.
7. Package the NSIS installer without rebuilding the signed executable.
8. Sign and timestamp the NSIS installer.
9. Verify both signatures and record SHA-256 values.
10. Run installer smoke tests on the exact signed installer.
11. Publish only the verified bytes; never rebuild after checksums are recorded.

## Verification commands

Use the tools available on the signing runner. Absence of `signtool` is a failed signing-verification gate, not permission to skip verification.

```powershell
Get-AuthenticodeSignature .\zen-canvas.exe | Format-List Status,StatusMessage,SignerCertificate,TimeStamperCertificate
Get-AuthenticodeSignature '.\Zen Canvas_0.1.39_x64-setup.exe' | Format-List Status,StatusMessage,SignerCertificate,TimeStamperCertificate
certutil -hashfile .\zen-canvas.exe SHA256
certutil -hashfile '.\Zen Canvas_0.1.39_x64-setup.exe' SHA256
signtool verify /pa /all /v .\zen-canvas.exe
signtool verify /pa /all /v '.\Zen Canvas_0.1.39_x64-setup.exe'
```

## Release evidence required

- Certificate subject, issuer, serial-number fingerprint, and validity window (never the private key).
- Timestamp authority and successful timestamp verification.
- Signature verification output for the executable and installer.
- SHA-256 values for the exact signed artifacts.
- Signed-installer install, upgrade/overwrite, uninstall, and reinstall results.
- SmartScreen observations from a clean Windows environment.
- CI run URL and immutable source commit.

Until all items above are complete, the recommendation remains: keep the Windows RC for engineering review, but do not publicly distribute the installer.

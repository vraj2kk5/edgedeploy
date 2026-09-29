# EdgeDeploy Troubleshooting Guide

## Common Issues & Solutions

### 1. `Can't connect to MySQL server on '127.0.0.1'` (ERROR 2002)
- **Cause:** MariaDB / MySQL server process is stopped.
- **Solution:** Start MySQL service via XAMPP Control Panel or command line:
  ```powershell
  Start-Process "C:\xampp\mysql\bin\mysqld.exe" -ArgumentList "--defaults-file=C:\xampp\mysql\bin\my.ini"
  ```

### 2. `Table 'edgedeploy.xyz' doesn't exist`
- **Cause:** Database schema has not been migrated yet.
- **Solution:** Run `npm run db:migrate` and `npm run db:seed`.

### 3. Gateway returns `503 Service Unavailable`
- **Cause:** No Edge Nodes are running or marked `HEALTHY`.
- **Solution:** Ensure edge processes are running via `npm run edges` or `npm run dev`.

### 4. Build Service fails with `Output directory dist was not created`
- **Cause:** Build command did not output static files to `dist`.
- **Solution:** Check project settings in Dashboard or fixture script output.

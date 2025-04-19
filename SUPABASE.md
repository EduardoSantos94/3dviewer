# Supabase Configuration for Jewelry Viewer

This document outlines the Supabase setup and configuration for the Jewelry Viewer application.

## Project Setup

1. Create a new Supabase project at [https://app.supabase.com](https://app.supabase.com)
2. Note down your project URL and anon public key from Project Settings > API

## Storage Configuration

1. Create a new storage bucket named `client-files`
2. Configure bucket permissions:
   ```sql
   -- Allow authenticated users to upload files
   CREATE POLICY "Authenticated users can upload files"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'client-files' AND auth.uid()::text = (storage.foldername(name))[1]);

   -- Allow authenticated users to read their own files
   CREATE POLICY "Users can view their own files"
   ON storage.objects FOR SELECT
   TO authenticated
   USING (bucket_id = 'client-files' AND auth.uid()::text = (storage.foldername(name))[1]);

   -- Allow authenticated users to delete their own files
   CREATE POLICY "Users can delete their own files"
   ON storage.objects FOR DELETE
   TO authenticated
   USING (bucket_id = 'client-files' AND auth.uid()::text = (storage.foldername(name))[1]);
   ```

## Authentication Setup

1. Enable Email authentication in Authentication > Providers
2. Configure email templates in Authentication > Email Templates
3. Set up password reset and confirmation email templates

## Environment Variables

Required environment variables for the application:

```javascript
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_anon_key
```

## File Storage Structure

Files are stored in the following structure:
```
client-files/
  ├── user_id_1/
  │   ├── timestamp-random-filename.3dm
  │   └── timestamp-random-filename.obj
  ├── user_id_2/
  │   └── timestamp-random-filename.stl
```

## Security Considerations

1. Files are stored with user-specific paths
2. Original filenames are preserved in metadata
3. Storage policies ensure users can only access their own files
4. File size limits are enforced (default 50MB)

## Common Issues

1. **400 Bad Request**: Usually caused by:
   - Invalid file path
   - Missing authentication
   - Expired URLs
   - Storage policy restrictions

2. **File Access**: Ensure:
   - User is authenticated
   - File path includes correct user ID
   - Storage policies are properly configured

## Debugging Tips

1. Check browser console for detailed error messages
2. Verify storage bucket permissions
3. Confirm file paths include user ID
4. Check authentication state
5. Verify URL construction for file access

## API Usage Examples

### Upload File
```javascript
const { data, error } = await supabase.storage
  .from('client-files')
  .upload(`${userId}/${filename}`, file, {
    metadata: {
      originalName: file.name
    }
  });
```

### List Files
```javascript
const { data, error } = await supabase.storage
  .from('client-files')
  .list(userId);
```

### Delete File
```javascript
const { error } = await supabase.storage
  .from('client-files')
  .remove([`${userId}/${filename}`]);
```

### Get Public URL
```javascript
const { data } = supabase.storage
  .from('client-files')
  .getPublicUrl(`${userId}/${filename}`);
``` 
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({ region: "us-east-1" }); // עדכן את האזור לפי הצורך
const BUCKET_NAME = 'image-uplaod-30-04-2025';

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '3600'
            },
            body: ''
        };
    }

    try {
        console.log('Received event:', JSON.stringify(event, null, 2));
        
        let requestBody;
        if (event.isBase64Encoded) {
            const buffer = Buffer.from(event.body, 'base64');
            try {
                requestBody = JSON.parse(buffer.toString());
            } catch (e) {
                requestBody = { rawImage: event.body };
            }
        } else if (event.body) {
            try {
                requestBody = JSON.parse(event.body);
            } catch (e) {
                return {
                    statusCode: 400,
                    headers: getCorsHeaders(),
                    body: JSON.stringify({
                        success: false,
                        message: 'Invalid JSON body'
                    })
                };
            }
        } else {
            return {
                statusCode: 400,
                headers: getCorsHeaders(),
                body: JSON.stringify({
                    success: false,
                    message: 'Request body is missing'
                })
            };
        }
        
        // קבלת התמונה מהבקשה
        const imageData = requestBody.image || requestBody.rawImage;
        
        if (!imageData) {
            return {
                statusCode: 400,
                headers: getCorsHeaders(),
                body: JSON.stringify({
                    success: false,
                    message: 'Image data is missing'
                })
            };
        }
        
        const imageBuffer = Buffer.from(
            imageData.startsWith('data:image') ? imageData.split(',')[1] : imageData, 
            'base64'
        );
        
        console.log('Image buffer length:', imageBuffer.length);

        if (imageBuffer.length === 0) {
            return {
                statusCode: 400,
                headers: getCorsHeaders(),
                body: JSON.stringify({
                    success: false,
                    message: 'Empty image data'
                })
            };
        }

        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}.jpg`;

        // העלאת הקובץ ל-S3
        const uploadParams = {
            Bucket: BUCKET_NAME,
            Key: fileName,
            Body: imageBuffer,
            ContentType: 'image/jpeg',
        };
        
        console.log('Uploading to S3 with params:', JSON.stringify({
            Bucket: uploadParams.Bucket,
            Key: uploadParams.Key,
            ContentType: uploadParams.ContentType,
        }, null, 2));
        
        const uploadCommand = new PutObjectCommand(uploadParams);
        const uploadResult = await s3Client.send(uploadCommand);
        
        console.log('S3 upload result:', JSON.stringify(uploadResult, null, 2));

        const imageUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${fileName}`;

        return {
            statusCode: 200,
            headers: getCorsHeaders(),
            body: JSON.stringify({ 
                success: true,
                imageUrl,
                key: fileName
            })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: getCorsHeaders(),
            body: JSON.stringify({ 
                success: false,
                message: error.message || 'Internal server error',
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    }
};

function getCorsHeaders() {
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };
}

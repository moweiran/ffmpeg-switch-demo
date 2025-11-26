```
ffmpeg -i welcome.mp4 -c:v libx264 -profile:v high -pix_fmt yuv420p -s 704x1216 -r 25 -b:v 812k -c:a aac -ar 16000 -ac 1 -b:a 75k output.mp4

``` 
ffmpeg -i speaking.mp4 -vf "scale=720:1280,fps=30,setsar=1:1,format=yuv420p" -colorspace bt709 -color_range tv -color_primaries bt709 -color_trc bt709 -c:v libx264 -profile:v high -pix_fmt yuv420p -s 704x1216 -r 25 -b:v 812k -c:a aac -ar 16000 -ac 1 -b:a 75k output.mp4
```


ffmpeg -i idle1.mp4 -f lavfi -i anullsrc=channel_layout=mono:sample_rate=16000 \
       -c:v copy -c:a aac -ar 16000 -ac 1 -b:a 64k \
       -shortest idle2.mp4



ffmpeg -re -stream_loop -1 -i ./videos/mofei.mov -profile:v baseline -level 3.1 -g 60 -r 30 -s 720x1280 -pix_fmt yuv420p -b:v 1200k -maxrate 1200k -bufsize 1800k -ar 16000 -ac 1 -b:a 64k -preset medium -tune zerolatency -f flv -flush_packets 1 -flags +low_delay rtmps://rtmp.icommu.cn:4433/live/livestream

ffmpeg -re -stream_loop -1 -i ./videos/mofei.mov \
-c:v libx264 -profile:v baseline -level 3.1 -g 60 -r 30 -s 720x1280 -pix_fmt yuv420p \
-b:v 1200k -maxrate 1200k -bufsize 1800k -ar 16000 -ac 1 -b:a 64k \
-preset medium -tune zerolatency -f flv -flush_packets 1 -flags +low_delay \
rtmps://rtmp.icommu.cn:4433/live/livestream

ffmpeg -re -stream_loop -1 -i ./videos/mofei.mov \
-c:v libx264 -profile:v baseline -level 3.1 -g 60 -r 30 -s 720x1280 -pix_fmt yuv420p \
-b:v 1200k -maxrate 1200k -bufsize 1800k -c:a aac -ar 16000 -ac 1 -b:a 64k \
-preset medium -tune zerolatency -f flv -flush_packets 1 -flags +low_delay \
rtmps://rtmp.icommu.cn:4433/live/livestream
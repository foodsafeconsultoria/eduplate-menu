from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import subprocess, json

ROOT = Path(__file__).resolve().parent
ROOT.mkdir(exist_ok=True)
FF = r'C:\Users\simon\AppData\Local\CapCut\Apps\8.5.0.3590\ffmpeg.exe'
SRC = r'C:\Users\simon\Videos\Cardapios - Eduplate.mp4'
FONT = r'C:\Windows\Fonts\arial.ttf'
BOLD = r'C:\Windows\Fonts\arialbd.ttf'
scenes = [
 (176, 4, 4, (330,40,1000,540), 'DO PLANEJAMENTO AO PDF', ['Seu cardápio escolar.', 'Tudo em um só lugar.'], 'Veja o processo no EduPlate.'),
 (12, 12, 5, (35,25,800,540), '01 / CONFIGURE', ['Comece pelo', 'planejamento.'], 'Etapa de ensino, escolas e semana.'),
 (70, 10, 5, (655,210,650,370), '02 / ESCOLHA OS ALIMENTOS', ['Busque.', 'Selecione. Adicione.'], 'Ingredientes e fichas técnicas na montagem.'),
 (109, 10, 5, (40,110,650,470), '03 / MONTE AS REFEIÇÕES', ['O cardápio ganha', 'forma na tela.'], 'Organize os itens de cada refeição.'),
 (139, 12, 5, (40,145,800,440), '04 / AGILIZE A SEMANA', ['Copie as refeições', 'entre os dias.'], 'Preencha a semana e ajuste o que precisar.'),
 (152.5, 3, 5, (50,155,800,350), '05 / ACOMPANHE O RESUMO', ['Custos, nutrientes', 'e alertas à vista.'], 'Confira os indicadores do planejamento.'),
 (176, 4, 5, (330,40,1000,540), '06 / FINALIZE', ['Seu planejamento.', 'Agora em PDF.'], 'Pronto para imprimir e compartilhar.'),
 (176, 4, 5, (330,40,1000,540), 'EDUPLATE', ['Mais organização', 'na alimentação escolar.'], 'Conheça o EduPlate.'),
]

def text(draw, xy, s, size, color, bold=False):
    draw.text(xy, s, font=ImageFont.truetype(BOLD if bold else FONT,size), fill=color)

for i,(start,span,duration,crop,label,title,caption) in enumerate(scenes):
    bg=Image.new('RGB',(1080,1920),'#0c1821'); d=ImageDraw.Draw(bg)
    d.ellipse((650,-180,1350,520),fill='#112c2c')
    d.rounded_rectangle((76,170,84,214),radius=4,fill='#4ee69b')
    text(d,(102,170),'eduplate',36,'#ffffff',True)
    text(d,(76,296),label,23,'#4ee69b',True)
    for j,line in enumerate(title):
        size=60 if len(line)<23 else 52
        text(d,(76,357+j*78),line,size,'#ffffff',True)
    x,y,w,h=crop
    vh=round(920*h/w)//2*2
    vy=round(990-vh/2)
    d.rounded_rectangle((66,vy-10,1006,vy+vh+10),radius=20,fill='#325249')
    text(d,(76,1490),caption,32,'#e2eee8')
    text(d,(76,1550),'Demonstração do sistema',23,'#91aaa3')
    for k in range(8):
        d.rounded_rectangle((76+k*112,1650,172+k*112,1655),radius=2,fill='#4ee69b' if k<=i else '#29413e')
    bg.save(ROOT/f'bg{i}.png')
    speed=span/duration
    filt=f'[0:v]setpts=(PTS-STARTPTS)/{speed},crop={w}:{h}:{x}:{y},scale=920:{vh}:flags=lanczos,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=5[v];[1:v][v]overlay=80:{vy}:shortest=1,fade=t=in:st=0:d=0.15,format=yuv420p[out]'
    cmd=[FF,'-hide_banner','-loglevel','error','-y','-ss',str(start),'-t',str(span),'-i',SRC,'-loop','1','-i',str(ROOT/f'bg{i}.png'),'-filter_complex',filt,'-map','[out]','-an','-t',str(duration),'-c:v','mpeg4','-q:v','2','-threads','4',str(ROOT/f'scene{i}.mp4')]
    subprocess.run(cmd,check=True)
    print(f'Scene {i+1}/8 ready',flush=True)

(ROOT/'concat.txt').write_text(''.join(f"file 'scene{i}.mp4'\n" for i in range(len(scenes))),encoding='utf-8')
subprocess.run([FF,'-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(ROOT/'concat.txt'),'-c','copy','-movflags','+faststart',str(ROOT/'EduPlate-Cardapios-Reels.mp4')],check=True)
(ROOT/'edicao.json').write_text(json.dumps(scenes,ensure_ascii=False,indent=2),encoding='utf-8')
print('DONE',flush=True)



#!/bin/bash
sudo apt-get update --fix-missing
# Install software
# Tweaks
sudo apt install gnome-tweaks
## Install VS code https://linuxize.com/post/how-to-install-visual-studio-code-on-ubuntu-18-04/
sudo apt update
wget -q https://packages.microsoft.com/keys/microsoft.asc -O- | sudo apt-key add -
add-apt-repository "deb [arch=amd64] https://packages.microsoft.com/repos/vscode stable main" -y
sudo apt update
sudo apt install code -y
## gcc
sudo apt install gcc -y
sudo apt install build-essential -y
# install python 
sudo apt install python3-pip -y
# Install anaconda
sudo wget -O /tmp/Anaconda3-2023.09-0-Linux-x86_64.sh https://repo.anaconda.com/archive/Anaconda3-2023.09-0-Linux-x86_64.sh
# sha256sum Anaconda3-2020.11-Linux-x86_64.sh 
sudo chmod 755 /tmp/Anaconda3-2023.09-0-Linux-x86_64.sh 
/tmp/Anaconda3-2023.09-0-Linux-x86_64.sh -b -p $HOME/anaconda3
# create conda env for deep learning (run from current shell)
source ~/anaconda3/etc/profile.d/conda.sh
conda create -n dl python=3.9 -y
conda activate dl
pip install -r requirements.txt
cd $(python -c 'import site; print(site.getsitepackages()[0])')
mkdir sitecustomize  
cd sitecustomize 
echo "from rich.traceback import install\ninstall()" >> __init__.py
# install rich && stack trace
# install docker
# https://docs.docker.com/engine/install/ubuntu/
# install deps and docker key
sudo apt-get update
sudo apt-get install ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
# add the repository to apt sources:
echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
# finally install it
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin -y
# create the docker group
sudo groupadd docker
# add your user to the docker group
sudo usermod -aG docker $USER
newgrp docker
## install albert
echo 'deb http://download.opensuse.org/repositories/home:/manuelschneid3r/xUbuntu_23.10/ /' | sudo tee /etc/apt/sources.list.d/home:manuelschneid3r.list
curl -fsSL https://download.opensuse.org/repositories/home:manuelschneid3r/xUbuntu_23.10/Release.key | gpg --dearmor | sudo tee /etc/apt/trusted.gpg.d/home_manuelschneid3r.gpg > /dev/null
sudo apt update
sudo apt install albert
## Plank
sudo apt install plank -y
## ZSH + OhMyZSH
sudo apt install zsh -y
# zsh as default shell
sh -c "$(wget -O- https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" --unattended
sh -c "echo $(which zsh) >> /etc/shells" && chsh -s $(which zsh)

### plugins
git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions
git clone https://github.com/zsh-users/zsh-completions ${ZSH_CUSTOM:=~/.oh-my-zsh/custom}/plugins/zsh-completions
git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting
sudo apt install autojump -y

## Hyper
sudo wget -O /tmp/hyper_amd64.deb https://releases.hyper.is/download/deb
sudo apt install /tmp/hyper_amd64.deb -y

## OBS

sudo apt install ffmpeg -y

sudo add-apt-repository ppa:obsproject/obs-studio -y
sudo apt update
sudo apt install obs-studio -y

## shell extensions
sudo apt install gnome-shell-extensions -y
## neofetch
apt install neofetch -y
## ImageMagic
sudo apt-get install imagemagick -y
## final touch
sudo apt-get update --fix-missing
sudo apt-get clean
sudo apt-get autoremove

# My config
## link your stuff
ln -s ~/.dotfiles/.icons ~/.icons
ln -s ~/.dotfiles/.themes ~/.themes
rm -f ~/.zshrc
ln -s ~/.dotfiles/.zshrc ~/.zshrc 
rm -f ~/.hyper.js 
ln -s ~/.dotfiles/.hyper.js ~/.hyper.js 
rm -f ~/.gitconfig
ln -s ~/.dotfiles/.gitconfig ~/.gitconfig
rm -f -R ~/.vscode
ln -s ~/.dotfiles/.vscode ~/.vscode
ln -s ~/.dotfiles/.zprofile ~/.zprofile
ln -s  ~/.dotfiles/plank_themes/* ~/.local/share/plank/themes/
ln -s ~/.dotfiles/config ~/.config

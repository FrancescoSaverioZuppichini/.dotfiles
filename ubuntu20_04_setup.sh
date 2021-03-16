#!/bin/bash
sudo apt-get update --fix-missing
Install software
# Tweaks
sudo add-apt-repository universe -y
sudo apt install gnome-tweak-tool -y
## Install VS code https://linuxize.com/post/how-to-install-visual-studio-code-on-ubuntu-18-04/
sudo apt update
wget -q https://packages.microsoft.com/keys/microsoft.asc -O- | sudo apt-key add -
add-apt-repository "deb [arch=amd64] https://packages.microsoft.com/repos/vscode stable main" -y
sudo apt update
sudo apt install code -y
## gcc
sudo apt install gcc -y
sudo apt install build-essential -y
# Install anaconda
sudo wget -O /tmp/Anaconda3-2020.11-Linux-x86_64.sh https://repo.anaconda.com/archive/Anaconda3-2020.11-Linux-x86_64.sh
# sha256sum Anaconda3-2020.11-Linux-x86_64.sh 
sudo chmod 755 /tmp/Anaconda3-2020.11-Linux-x86_64.sh 
/tmp/Anaconda3-2020.11-Linux-x86_64.sh -b -p $HOME/anaconda3
# create conda env for deep learning (run from current shell)
source ~/anaconda3/etc/profile.d/conda.sh
conda create -n dl python=3.8 -y
conda activate dl
pip install -r requirements.txt
# install docker
sudo apt-get install \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg-agent \
    software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository \
   "deb [arch=amd64] https://download.docker.com/linux/ubuntu \
   $(lsb_release -cs) \
   stable" -y
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io -y
# to verify run sudo docker run hello-world
sudo usermod -aG docker $USER
# docker compose https://docs.docker.com/compose/install/
sudo curl -L "https://github.com/docker/compose/releases/download/1.28.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
## install albert
curl https://build.opensuse.org/projects/home:manuelschneid3r/public_key | sudo apt-key add -
echo 'deb http://download.opensuse.org/repositories/home:/manuelschneid3r/xUbuntu_20.04/ /' | sudo tee /etc/apt/sources.list.d/home:manuelschneid3r.list
wget -nv https://download.opensuse.org/repositories/home:manuelschneid3r/xUbuntu_20.04/Release.key -O "/etc/apt/trusted.gpg.d/home:manuelschneid3r.asc"
sudo apt update
sudo apt install albert -y
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
sudo wget -O /tmp/hyper_3.0.2_amd64.deb https://releases.hyper.is/download/deb
sudo apt install /tmp/hyper_3.0.2_amd64.deb -y

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
rm  -f ~/.gitconfig
ln -s ~/.dotfiles/.gitconfig ~/.gitconfig
rm -f -R ~/.vscode
ln -s ~/.dotfiles/.vscode ~/.vscode
ln -s ~/.dotfiles/.zprofile ~/.zprofile
# ln -s   ~/.dotfiles/plank_themes /home/$USER/.local/share/plank/themes
